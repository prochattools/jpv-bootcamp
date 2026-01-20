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

/** ----------------------------
 *  6) Provisioning endpoint (Next.js -> WP)
 *  ---------------------------- */

function jpv_portal_provision_get_token(): string {
    if (defined('WP_PROVISION_TOKEN') && WP_PROVISION_TOKEN) {
        return WP_PROVISION_TOKEN;
    }

    $env = getenv('WP_PROVISION_TOKEN');
    return $env ? $env : '';
}

function jpv_portal_provision_normalize_plan(?string $plan): array {
    $p = strtolower(trim((string)$plan));
    if ($p === 'vip') {
        return array('vip', 'vip');
    }
    if ($p === 'pro') {
        return array('pro', 'pro');
    }
    return array('', 'free');
}

function jpv_portal_provision_is_admin(WP_User $user): bool {
    return user_can($user->ID, 'manage_options') || in_array('administrator', (array) $user->roles, true);
}

function jpv_portal_provision_finish(int $status, array $response, array $log_data): WP_REST_Response {
    error_log('[JPV Provision] ' . wp_json_encode($log_data));
    return new WP_REST_Response($response, $status);
}

function jpv_portal_provision_create_user(string $email, string $first_name, string $last_name) {
    $base_username = sanitize_user(strstr($email, '@', true));
    if (!$base_username) {
        $base_username = 'jpv' . wp_generate_password(6, false, false);
    }

    $username = $base_username;
    $suffix = 1;
    while (username_exists($username)) {
        $username = $base_username . $suffix;
        $suffix++;
    }

    $user_data = array(
        'user_login' => $username,
        'user_email' => $email,
        'role' => 'subscriber',
        'user_pass' => wp_generate_password(24, true, true),
    );

    if ($first_name) {
        $user_data['first_name'] = $first_name;
    }
    if ($last_name) {
        $user_data['last_name'] = $last_name;
    }
    if ($first_name || $last_name) {
        $user_data['display_name'] = trim($first_name . ' ' . $last_name);
    }

    return wp_insert_user($user_data);
}

function jpv_portal_provision_handle_request(WP_REST_Request $request): WP_REST_Response {
    $params = $request->get_json_params();
    if (!is_array($params)) {
        $params = array();
    }

    $email = isset($params['email']) ? sanitize_email($params['email']) : '';
    $plan_in = isset($params['plan']) ? sanitize_text_field($params['plan']) : '';
    $first_name = isset($params['first_name']) ? sanitize_text_field($params['first_name']) : '';
    $last_name = isset($params['last_name']) ? sanitize_text_field($params['last_name']) : '';

    $log_data = array(
        'email' => $email,
        'plan_in' => $plan_in,
        'plan_norm' => '',
        'userId' => 0,
        'existing' => false,
        'created' => false,
        'is_admin' => false,
        'role_changed' => false,
        'membership_level_applied' => '',
        'reason' => '',
    );

    $header = $request->get_header('authorization');
    $expected = jpv_portal_provision_get_token();
    $authorized = false;

    if ($header && preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
        $provided = trim($matches[1]);
        if ($expected && hash_equals($expected, $provided)) {
            $authorized = true;
        }
    }

    if (!$authorized) {
        $log_data['reason'] = 'unauthorized';
        return jpv_portal_provision_finish(401, array(
            'ok' => false,
            'reason' => 'unauthorized',
        ), $log_data);
    }

    if (!is_email($email)) {
        $log_data['reason'] = 'invalid_email';
        return jpv_portal_provision_finish(400, array(
            'ok' => false,
            'reason' => 'invalid_email',
        ), $log_data);
    }

    list($plan_meta, $plan_norm) = jpv_portal_provision_normalize_plan($plan_in);
    $log_data['plan_norm'] = $plan_norm;

    $user = get_user_by('email', $email);
    if (!$user) {
        $user_id = jpv_portal_provision_create_user($email, $first_name, $last_name);
        if (is_wp_error($user_id)) {
            $log_data['reason'] = 'create_failed';
            return jpv_portal_provision_finish(500, array(
                'ok' => false,
                'reason' => 'create_failed',
            ), $log_data);
        }

        update_user_meta($user_id, 'jpv_membership_level', $plan_meta);

        $log_data['userId'] = (int) $user_id;
        $log_data['created'] = true;
        $log_data['role_changed'] = true;
        $log_data['membership_level_applied'] = $plan_norm;
        $log_data['reason'] = 'created_user_set_subscriber';

        return jpv_portal_provision_finish(200, array(
            'ok' => true,
            'wp_user_id' => (int) $user_id,
            'created' => true,
            'existing' => false,
            'role_changed' => true,
            'membership_level_applied' => $plan_norm,
            'reason' => 'created_user_set_subscriber',
        ), $log_data);
    }

    $user_id = (int) $user->ID;
    $log_data['userId'] = $user_id;
    $log_data['existing'] = true;
    $is_admin = jpv_portal_provision_is_admin($user);
    $log_data['is_admin'] = $is_admin;

    $allow_admin = defined('ALLOW_ADMIN_PROVISIONING') && ALLOW_ADMIN_PROVISIONING;
    if ($is_admin && !$allow_admin) {
        $log_data['reason'] = 'admin_guard';
        return jpv_portal_provision_finish(409, array(
            'ok' => false,
            'reason' => 'admin_guard',
            'existing' => true,
            'is_admin' => true,
            'role_changed' => false,
        ), $log_data);
    }

    update_user_meta($user_id, 'jpv_membership_level', $plan_meta);

    $log_data['membership_level_applied'] = $plan_norm;
    $log_data['reason'] = 'existing_user_no_role_change';

    return jpv_portal_provision_finish(200, array(
        'ok' => true,
        'wp_user_id' => $user_id,
        'created' => false,
        'existing' => true,
        'role_changed' => false,
        'membership_level_applied' => $plan_norm,
        'reason' => 'existing_user_no_role_change',
    ), $log_data);
}

function jpv_portal_provision_register_routes(): void {
    register_rest_route('jpv/v1', '/provision', array(
        'methods' => 'POST',
        'callback' => 'jpv_portal_provision_handle_request',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'jpv_portal_provision_register_routes');
