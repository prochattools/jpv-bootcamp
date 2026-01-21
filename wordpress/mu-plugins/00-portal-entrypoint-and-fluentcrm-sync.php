<?php
/**
 * MU Plugin: Portal entrypoint + FluentCRM sync (JPV)
 *
 * Goals:
 * - Never show WP frontend on / (portal root)
 *   - logged out -> /community/?fcom_action=auth
 *   - logged in  -> /community/
 * - /admin should go to WP login (keep WP admin access)
 * - On WP user create/update membership meta, upsert FluentCRM contact:
 *   - Always in "Members" list
 *   - Exactly ONE tag: Free | Pro | VIP
 * - Tag derived from user meta 'jpv_membership_level' (pro|vip), default Free
 * - Retries capped (max 5) and do not infinite-loop due to reason prefixing
 */

if (!defined('ABSPATH')) exit;

/** ----------------------------
 *  1) Portal routing / redirects
 *  ---------------------------- */

// /admin -> wp-login.php (admins only, explicit)
add_action('init', function () {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    // exact /admin or /admin/ (don’t hijack /wp-admin)
    if ($uri === '/admin' || $uri === '/admin/') {
        wp_safe_redirect(site_url('/wp-login.php'), 302);
        exit;
    }
});

// Root -> FluentCommunity auth/dashboard
add_action('template_redirect', function () {
    if (!is_front_page() && !is_home()) return;

    $login_url     = site_url('/community/?fcom_action=auth');
    $dashboard_url = site_url('/community/');

    if (!is_user_logged_in()) {
        wp_safe_redirect($login_url, 302);
        exit;
    }

    wp_safe_redirect($dashboard_url, 302);
    exit;
});

add_filter('logout_redirect', function () {
    return site_url('/community/?fcom_action=auth');
}, 10, 3);

/** ----------------------------
 *  2) FluentCRM availability + plan normalization
 *  ---------------------------- */

function jpv_fluentcrm_is_available(): bool {
    return function_exists('FluentCrmApi');
}

function jpv_normalize_plan(?string $plan): string {
    $p = strtolower(trim((string)$plan));
    if ($p === 'vip') return 'VIP';
    if ($p === 'pro') return 'Pro';
    return 'Free';
}

function jpv_get_user_plan(int $user_id): string {
    $plan = get_user_meta($user_id, 'jpv_membership_level', true);
    if ($plan === 'none') $plan = '';
    return jpv_normalize_plan($plan);
}

/** ----------------------------
 *  3) Retry cap (fixes “deferred:deferred:...” loop)
 *  ---------------------------- */

function jpv_base_reason(string $reason): string {
    // strip prefixes so retry key remains stable
    $r = (string)$reason;
    while (true) {
        $new = preg_replace('/^(deferred:|retry:)+/i', '', $r);
        if ($new === $r) break;
        $r = $new;
    }
    return $r ?: 'unknown';
}

function jpv_retry_key(string $reason): string {
    $base = jpv_base_reason($reason);
    return 'jpv_fcrm_retry_' . substr(md5($base), 0, 12);
}

function jpv_retry_allowed(int $user_id, string $reason, int $max = 5): bool {
    $key = jpv_retry_key($reason);
    $count = (int) get_user_meta($user_id, $key, true);
    return $count < $max;
}

function jpv_retry_bump(int $user_id, string $reason): int {
    $key = jpv_retry_key($reason);
    $count = (int) get_user_meta($user_id, $key, true);
    $count++;
    update_user_meta($user_id, $key, $count);
    return $count;
}

function jpv_schedule_deferred_sync(int $user_id, string $reason): void {
    $base = jpv_base_reason($reason);

    if (!jpv_retry_allowed($user_id, $base, 5)) {
        error_log('[JPV Portal/FluentCRM] Giving up after max retries ' . json_encode(['userId'=>$user_id,'reason'=>$base]));
        return;
    }

    $attempt = jpv_retry_bump($user_id, $base);
    $delay = min(60, 5 * $attempt); // 5,10,15,20,25 (cap 60)

    // prevent duplicate scheduled events for same user+reason
    $args = [$user_id, $base];
    if (!wp_next_scheduled('jpv_fcrm_deferred_sync', $args)) {
        wp_schedule_single_event(time() + $delay, 'jpv_fcrm_deferred_sync', $args);
    }

    error_log('[JPV Portal/FluentCRM] Scheduled deferred sync ' . json_encode([
        'userId' => $user_id,
        'reason' => $base,
        'attempt'=> $attempt,
        'delaySec'=>$delay
    ]));
}

add_action('jpv_fcrm_deferred_sync', function ($user_id, $reason) {
    jpv_fluentcrm_sync_user((int)$user_id, 'deferred:' . (string)$reason);
}, 10, 2);

/** ----------------------------
 *  4) Core sync (USE FluentCrmApi('contacts') — NOT 'subscribers')
 *  ---------------------------- */

function jpv_fluentcrm_sync_user(int $user_id, string $reason = 'unknown'): void {
    if (!jpv_fluentcrm_is_available()) return;

    $user = get_user_by('id', $user_id);
    if (!$user || empty($user->user_email)) return;

    $email = $user->user_email;
    $plan  = jpv_get_user_plan($user_id); // Free|Pro|VIP

    // enforce exactly one plan tag
    $detach = [];
    foreach (['Free','Pro','VIP'] as $t) {
        if ($t !== $plan) $detach[] = $t;
    }

    try {
        $contactApi = FluentCrmApi('contacts');

        $data = [
            'email'      => $email,
            'first_name' => $user->first_name ?: '',
            'last_name'  => $user->last_name ?: '',
            'status'     => 'subscribed',
            'user_id'    => (int)$user_id,

            'lists'       => ['Members'],
            'tags'        => [$plan],
            'detach_tags' => $detach,
        ];

        $contact = $contactApi->createOrUpdate($data, true);

        if (!$contact) {
            throw new \RuntimeException('createOrUpdate returned false');
        }

        error_log('[JPV Portal/FluentCRM] Synced ' . json_encode([
            'email' => $email,
            'plan'  => $plan,
            'reason'=> $reason
        ]));
    } catch (\Throwable $e) {
        error_log('[JPV Portal/FluentCRM] Sync failed ' . json_encode([
            'email'  => $email,
            'plan'   => $plan,
            'reason' => $reason,
            'err'    => $e->getMessage()
        ]));
        jpv_schedule_deferred_sync($user_id, $reason);
    }
}

/** ----------------------------
 *  5) Triggers
 *  ---------------------------- */

add_action('user_register', function ($user_id) {
    jpv_fluentcrm_sync_user((int)$user_id, 'user_register');
}, 20, 1);

add_action('added_user_meta', function ($meta_id, $user_id, $meta_key, $meta_value) {
    if ($meta_key !== 'jpv_membership_level') return;
    jpv_fluentcrm_sync_user((int)$user_id, 'added_user_meta:jpv_membership_level');
}, 20, 4);

add_action('updated_user_meta', function ($meta_id, $user_id, $meta_key, $meta_value) {
    if ($meta_key !== 'jpv_membership_level') return;
    jpv_fluentcrm_sync_user((int)$user_id, 'updated_user_meta:jpv_membership_level');
}, 20, 4);

/**
 * After deploying: if you previously cached IDs, you may delete these options once:
 * - jpv_fluentcrm_members_list_id
 * - jpv_fluentcrm_tag_id_*
 */
/**
 * Provisioning endpoint lives in wordpress/mu-plugins/jpv-provisioning.php.
 */
