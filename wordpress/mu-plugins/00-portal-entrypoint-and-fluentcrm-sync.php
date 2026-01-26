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
 *  0) Portal lock (block WP theme everywhere except allowlist)
 *  ---------------------------- */

function jpv_portal_lock_send_headers(string $why): void {
    if (headers_sent()) {
        return;
    }
    header('X-JPV-Portal-Lock: blocked', true);
    header('X-JPV-Portal-Why: ' . $why, true);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
}

function jpv_portal_path_starts_with(string $path, string $prefix): bool {
    return strncmp($path, $prefix, strlen($prefix)) === 0;
}

function jpv_portal_is_allowed_path(string $path): bool {
    if ($path === '/wp-login.php') return true;
    if ($path === '/wp-cron.php') return true;
    if ($path === '/wp-admin/admin-ajax.php') return true;
    if ($path === '/favicon.ico' || $path === '/robots.txt') return true;

    if (jpv_portal_path_starts_with($path, '/wp-json')) return true;
    if (jpv_portal_path_starts_with($path, '/community')) return true;
    if (jpv_portal_path_starts_with($path, '/go/billing-portal')) return true;
    if (jpv_portal_path_starts_with($path, '/go/upgrade-vip')) return true;
    if (jpv_portal_path_starts_with($path, '/go/partners')) return true;
    if (jpv_portal_path_starts_with($path, '/wp-content')) return true;
    if (jpv_portal_path_starts_with($path, '/wp-includes')) return true;

    if (jpv_portal_path_starts_with($path, '/wp-admin')) {
        return current_user_can('manage_options');
    }

    return false;
}

function jpv_portal_lockdown(): void {
    if (defined('WP_CLI') && WP_CLI) {
        return;
    }

    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if ($uri === '') {
        return;
    }

    // ---- Fluent Community editor fix: never portal-lock programmatic requests ----
    // OPTIONS preflight: redirecting these can make SPAs hang.
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'OPTIONS') {
        return;
    }

    // WP AJAX: editor relies on admin-ajax and other AJAX calls.
    if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
        return;
    }

    // WP REST: sometimes uses /wp-json/... but can also hit "/?rest_route=..."
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return;
    }
    if (!empty($_GET['rest_route'])) {
        return;
    }
    // ---------------------------------------------------------------------------

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path) {
        return;
    }

    if (jpv_portal_is_allowed_path($path)) {
        return;
    }

    $target = is_user_logged_in()
        ? site_url('/community/')
        : site_url('/community/?fcom_action=auth');

    jpv_portal_lock_send_headers('route_blocked');
    wp_safe_redirect($target, 302);
    exit;
}
add_action('init', 'jpv_portal_lockdown', 0);

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

/** ----------------------------
 *  6) Entitlements sync (Stripe -> Prisma -> FluentCRM)
 *  ---------------------------- */

const JPV_ENTITLEMENTS_ENDPOINT = 'https://jpvbootcamp.com/api/entitlements';
const JPV_ENTITLEMENTS_SYNC_TTL = 300;

function jpv_entitlements_get_secret(): string {
    $env = getenv('BILLING_PORTAL_HMAC_SECRET');
    if ($env !== false && trim((string) $env) !== '') {
        return trim((string) $env);
    }

    if (!empty($_ENV['BILLING_PORTAL_HMAC_SECRET'])) {
        return trim((string) $_ENV['BILLING_PORTAL_HMAC_SECRET']);
    }

    if (!empty($_SERVER['BILLING_PORTAL_HMAC_SECRET'])) {
        return trim((string) $_SERVER['BILLING_PORTAL_HMAC_SECRET']);
    }

    if (defined('BILLING_PORTAL_HMAC_SECRET') && BILLING_PORTAL_HMAC_SECRET) {
        return trim((string) BILLING_PORTAL_HMAC_SECRET);
    }

    return '';
}

function jpv_entitlements_base64url_encode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function jpv_entitlements_build_token(string $email, string $secret): string {
    $issued_at = time();
    try {
        $nonce = bin2hex(random_bytes(12));
    } catch (Throwable $e) {
        $nonce = wp_generate_password(16, false, false);
    }
    $payload = array(
        'email' => $email,
        'iat' => $issued_at,
        'exp' => $issued_at + 600,
        'nonce' => $nonce,
    );

    $payload_json = wp_json_encode($payload);
    $payload_b64 = jpv_entitlements_base64url_encode($payload_json);
    $signature = hash_hmac('sha256', $payload_b64, $secret, true);
    $signature_b64 = jpv_entitlements_base64url_encode($signature);

    return $payload_b64 . '.' . $signature_b64;
}

function jpv_entitlements_fetch_plan(string $email): ?string {
    $secret = jpv_entitlements_get_secret();
    if ($secret === '') {
        return null;
    }

    $token = jpv_entitlements_build_token($email, $secret);
    $response = wp_remote_get(JPV_ENTITLEMENTS_ENDPOINT, array(
        'timeout' => 5,
        'headers' => array(
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ),
    ));

    if (is_wp_error($response)) {
        return null;
    }

    $status = (int) wp_remote_retrieve_response_code($response);
    if ($status < 200 || $status >= 300) {
        return null;
    }

    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    if (!is_array($data)) {
        return null;
    }

    $plan = isset($data['plan']) ? strtolower(trim((string) $data['plan'])) : '';
    if (!in_array($plan, array('free', 'pro', 'vip'), true)) {
        return null;
    }

    return $plan;
}

function jpv_entitlements_should_sync(int $user_id): bool {
    $last = (int) get_user_meta($user_id, 'jpv_entitlements_last_sync', true);
    if ($last && (time() - $last) < JPV_ENTITLEMENTS_SYNC_TTL) {
        return false;
    }
    return true;
}

function jpv_entitlements_sync_user(int $user_id, string $context): void {
    if (!$user_id || !jpv_entitlements_should_sync($user_id)) {
        return;
    }

    update_user_meta($user_id, 'jpv_entitlements_last_sync', time());

    $user = get_user_by('id', $user_id);
    if (!$user || empty($user->user_email)) {
        return;
    }

    $plan = jpv_entitlements_fetch_plan($user->user_email);
    if ($plan === null) {
        return;
    }

    $plan_meta = $plan === 'free' ? '' : $plan;
    $current = get_user_meta($user_id, 'jpv_membership_level', true);
    if ($current === 'none') {
        $current = '';
    }

    if ($current !== $plan_meta) {
        update_user_meta($user_id, 'jpv_membership_level', $plan_meta);
    }
}

function jpv_entitlements_sync_on_login(string $user_login, WP_User $user): void {
    jpv_entitlements_sync_user((int) $user->ID, 'login');
}
add_action('wp_login', 'jpv_entitlements_sync_on_login', 20, 2);

function jpv_entitlements_sync_on_community(): void {
    if (!is_user_logged_in()) {
        return;
    }
    if (is_admin()) {
        return;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return;
    }
    if (wp_doing_ajax()) {
        return;
    }

    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri && stripos($uri, '/community') === false) {
        return;
    }

    jpv_entitlements_sync_user((int) get_current_user_id(), 'community');
}
add_action('template_redirect', 'jpv_entitlements_sync_on_community', 5);