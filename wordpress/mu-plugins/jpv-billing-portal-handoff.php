<?php
/**
 * MU Plugin: Billing portal signed handoff (JPV)
 *
 * Use /go/billing-portal?return=... in Fluent Community menu
 * Recommended filename prefix for MU load order: 10-jpv-billing-portal-handoff.php
 *
 * This file is stored in the Next.js repo for manual deployment to WordPress; it is not auto-deployed.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JPV_BILLING_PORTAL_URL = 'https://jpvbootcamp.com/billing/portal';
const JPV_BILLING_PORTAL_DEFAULT_RETURN_URL = 'https://portal.jpvbootcamp.com/community/';
const JPV_BILLING_PORTAL_FALLBACK_URL = 'https://jpvbootcamp.com/upgrade';

function get_billing_portal_hmac_secret(): ?string {
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

    return null;
}

function jpv_billing_portal_base64url_encode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function jpv_billing_portal_random_nonce(): string {
    try {
        return bin2hex(random_bytes(12));
    } catch (Throwable $e) {
        return wp_generate_password(16, false, false);
    }
}

function jpv_billing_portal_strip_chained_url(string $value): string {
    if (!preg_match_all('#https?://#i', $value, $matches, PREG_OFFSET_CAPTURE)) {
        return $value;
    }
    if (count($matches[0]) < 2) {
        return $value;
    }
    $second = $matches[0][1][1];
    return substr($value, 0, $second);
}

function jpv_billing_portal_normalize_return_url(?string $raw): string {
    if (!$raw) {
        return JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;
    }

    $candidate = trim((string) $raw);
    if ($candidate === '') {
        return JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;
    }

    $decoded = rawurldecode($candidate);
    $decoded = jpv_billing_portal_strip_chained_url($decoded);

    $parts = wp_parse_url($decoded);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;
    }

    $origin = $parts['scheme'] . '://' . $parts['host'];
    if (!empty($parts['port'])) {
        $origin .= ':' . $parts['port'];
    }

    $allowed = array('https://portal.jpvbootcamp.com', 'https://jpvbootcamp.com');
    if (!in_array($origin, $allowed, true)) {
        return JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;
    }

    return $decoded;
}

function jpv_billing_portal_extract_return_url(string $url): string {
    $parts = wp_parse_url($url);
    if (empty($parts['query'])) {
        return JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;
    }

    parse_str($parts['query'], $query);
    if (empty($query['return'])) {
        return JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;
    }

    return jpv_billing_portal_normalize_return_url($query['return']);
}

function jpv_billing_portal_is_target_url(string $url): bool {
    return strpos($url, '/billing/portal') !== false;
}

function jpv_billing_portal_build_token(string $email, string $return_url, string $secret): string {
    $issued_at = time();
    $payload = array(
        'email' => $email,
        'returnUrl' => $return_url,
        'iat' => $issued_at,
        'exp' => $issued_at + 300,
        'nonce' => jpv_billing_portal_random_nonce(),
    );

    $payload_json = wp_json_encode($payload);
    $payload_b64 = jpv_billing_portal_base64url_encode($payload_json);
    $signature = hash_hmac('sha256', $payload_b64, $secret, true);
    $signature_b64 = jpv_billing_portal_base64url_encode($signature);

    return $payload_b64 . '.' . $signature_b64;
}

function jpv_billing_portal_build_url(string $token): string {
    return JPV_BILLING_PORTAL_URL . '?token=' . rawurlencode($token);
}

function jpv_billing_portal_log_missing_secret_once(): void {
    static $logged = false;
    if ($logged) {
        return;
    }
    $logged = true;

    $throttle_key = 'jpv_billing_portal_secret_missing_logged';
    if (get_transient($throttle_key)) {
        return;
    }

    set_transient($throttle_key, '1', HOUR_IN_SECONDS);
    error_log('[JPV Billing Portal] BILLING_PORTAL_HMAC_SECRET missing; upgrade link disabled.');
}

function jpv_billing_portal_get_email_domain(string $email): string {
    $pos = strrpos($email, '@');
    if ($pos === false || $pos === strlen($email) - 1) {
        return '';
    }
    return substr($email, $pos + 1);
}

function jpv_billing_portal_send_nocache_headers(): void {
    if (headers_sent()) {
        return;
    }
    if (function_exists('nocache_headers')) {
        nocache_headers();
    }
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
}

function jpv_billing_portal_send_go_headers(string $path): void {
    if (headers_sent()) {
        return;
    }
    if (function_exists('nocache_headers')) {
        nocache_headers();
    }
    header('X-JPV-Go-Handler: hit', true);
    header('X-JPV-Go-Path: ' . substr($path, 0, 120), true);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
}

function jpv_billing_portal_build_full_url(string $uri): string {
    $host = '';
    if (!empty($_SERVER['HTTP_HOST'])) {
        $host = (string) $_SERVER['HTTP_HOST'];
    } elseif (!empty($_SERVER['SERVER_NAME'])) {
        $host = (string) $_SERVER['SERVER_NAME'];
    } else {
        $parsed = wp_parse_url(home_url('/'));
        if (!empty($parsed['host'])) {
            $host = (string) $parsed['host'];
        }
    }

    if ($host === '') {
        return $uri;
    }

    $scheme = is_ssl() ? 'https' : 'https';
    $path = $uri;
    if ($path === '' || $path[0] !== '/') {
        $path = '/' . ltrim($path, '/');
    }

    return $scheme . '://' . $host . $path;
}

function jpv_billing_portal_log_go_endpoint(array $data): void {
    error_log('[JPV Billing Portal] go endpoint ' . wp_json_encode($data));
}

function jpv_billing_portal_path_matches_go(string $path): bool {
    $needle = '/go/billing-portal';
    if ($path === $needle || $path === $needle . '/') {
        return true;
    }

    $trimmed = rtrim($path, '/');
    if ($trimmed === $needle) {
        return true;
    }

    if (substr($trimmed, -strlen($needle)) === $needle) {
        return true;
    }

    $segment = trim($needle, '/');
    return (bool) preg_match('#(^|/)' . preg_quote($segment, '#') . '(/|$)#', $path);
}

function jpv_billing_portal_build_signed_url(string $email, string $original_url, string $secret): string {
    $parts = wp_parse_url($original_url);
    if (!empty($parts['query'])) {
        parse_str($parts['query'], $query);
        if (!empty($query['token'])) {
            return $original_url;
        }
    }

    $return_url = jpv_billing_portal_extract_return_url($original_url);
    $token = jpv_billing_portal_build_token($email, $return_url, $secret);
    return jpv_billing_portal_build_url($token);
}

function jpv_billing_portal_filter_menu_items($items, $args) {
    if (!is_array($items) || empty($items)) {
        return $items;
    }

    $secret = get_billing_portal_hmac_secret();
    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    $found_target = false;

    foreach ($items as $index => $item) {
        if (!is_object($item) || empty($item->url)) {
            continue;
        }
        if (!jpv_billing_portal_is_target_url($item->url)) {
            continue;
        }
        $found_target = true;

        if (!is_user_logged_in() || !is_email($email)) {
            unset($items[$index]);
            continue;
        }

        if (!$secret) {
            unset($items[$index]);
            continue;
        }

        $item->url = jpv_billing_portal_build_signed_url($email, $item->url, $secret);
    }

    if ($found_target && !$secret) {
        jpv_billing_portal_log_missing_secret_once();
    }

    return array_values($items);
}
add_filter('wp_nav_menu_objects', 'jpv_billing_portal_filter_menu_items', 10, 2);

function jpv_billing_portal_handle_go_endpoint(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path) {
        return;
    }

    if (!jpv_billing_portal_path_matches_go($path)) {
        return;
    }

    $logged_in = is_user_logged_in();
    $secret = get_billing_portal_hmac_secret();
    $has_secret = $secret ? true : false;
    $original_url = jpv_billing_portal_build_full_url($uri);

    if (!is_user_logged_in()) {
        $login_url = site_url('/community/?fcom_action=auth');
        $redirect_to = $original_url;
        $login_url = add_query_arg('redirect_to', $redirect_to, $login_url);
        jpv_billing_portal_log_go_endpoint(array(
            'loggedIn' => $logged_in,
            'hasSecret' => $has_secret,
            'redirect' => 'login',
        ));
        jpv_billing_portal_send_go_headers($path);
        wp_safe_redirect($login_url, 302);
        exit;
    }

    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    if (!is_email($email)) {
        jpv_billing_portal_log_go_endpoint(array(
            'loggedIn' => $logged_in,
            'hasSecret' => $has_secret,
            'redirect' => 'fallback_invalid_email',
        ));
        jpv_billing_portal_send_go_headers($path);
        wp_safe_redirect(JPV_BILLING_PORTAL_FALLBACK_URL, 302);
        exit;
    }

    if (!$secret) {
        jpv_billing_portal_log_missing_secret_once();
        jpv_billing_portal_log_go_endpoint(array(
            'loggedIn' => $logged_in,
            'hasSecret' => $has_secret,
            'redirect' => 'fallback_missing_secret',
            'emailDomain' => jpv_billing_portal_get_email_domain($email),
        ));
        jpv_billing_portal_send_go_headers($path);
        wp_safe_redirect(JPV_BILLING_PORTAL_FALLBACK_URL, 302);
        exit;
    }

    $return_param = isset($_GET['return']) ? (string) $_GET['return'] : '';
    $return_url = $return_param !== ''
        ? jpv_billing_portal_normalize_return_url($return_param)
        : JPV_BILLING_PORTAL_DEFAULT_RETURN_URL;

    $token = jpv_billing_portal_build_token($email, $return_url, $secret);
    $target = jpv_billing_portal_build_url($token);

    jpv_billing_portal_log_go_endpoint(array(
        'loggedIn' => $logged_in,
        'hasSecret' => $has_secret,
        'redirect' => 'billing_portal',
        'emailDomain' => jpv_billing_portal_get_email_domain($email),
        'returnUrl' => $return_url,
        'tokenPrefix' => substr($token, 0, 8),
    ));

    jpv_billing_portal_send_go_headers($path);
    wp_safe_redirect($target, 302);
    exit;
}
add_action('init', 'jpv_billing_portal_handle_go_endpoint', 0);

function jpv_billing_portal_handle_redirect(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path) {
        $path = $uri;
    }

    if (stripos($path, '/jpv/billing/portal') !== 0) {
        return;
    }

    $return_param = isset($_GET['return']) ? (string) $_GET['return'] : '';

    if (!is_user_logged_in()) {
        $redirect_back = home_url($uri);
        $login_url = site_url('/community/?fcom_action=auth');
        $login_url = add_query_arg('redirect_to', $redirect_back, $login_url);
        wp_safe_redirect($login_url, 302);
        exit;
    }

    $secret = get_billing_portal_hmac_secret();
    if (!$secret) {
        jpv_billing_portal_log_missing_secret_once();
        wp_safe_redirect(JPV_BILLING_PORTAL_FALLBACK_URL, 302);
        exit;
    }

    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    if (!is_email($email)) {
        wp_safe_redirect(JPV_BILLING_PORTAL_FALLBACK_URL, 302);
        exit;
    }

    $return_url = jpv_billing_portal_normalize_return_url($return_param);
    $token = jpv_billing_portal_build_token($email, $return_url, $secret);
    $target = jpv_billing_portal_build_url($token);

    wp_safe_redirect($target, 302);
    exit;
}
add_action('init', 'jpv_billing_portal_handle_redirect', 1);

function jpv_billing_portal_rewrite_output(string $html): string {
    $secret = get_billing_portal_hmac_secret();
    if (!$secret || !is_user_logged_in()) {
        return $html;
    }

    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    if (!is_email($email)) {
        return $html;
    }

    $pattern = '#https://jpvbootcamp\\.com/billing/portal(?:\\?[^"\'\\s<>]*)?#i';
    return preg_replace_callback($pattern, function ($matches) use ($email, $secret) {
        return jpv_billing_portal_build_signed_url($email, $matches[0], $secret);
    }, $html);
}

function jpv_billing_portal_start_output_buffer(): void {
    // Preferred: /go/billing-portal endpoint (Fluent Community is a SPA).
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

    $secret = get_billing_portal_hmac_secret();
    if (!$secret) {
        jpv_billing_portal_log_missing_secret_once();
        return;
    }

    static $started = false;
    if ($started) {
        return;
    }
    $started = true;

    ob_start('jpv_billing_portal_rewrite_output');
}
add_action('template_redirect', 'jpv_billing_portal_start_output_buffer', 1);

function jpv_billing_portal_health_check(WP_REST_Request $request): WP_REST_Response {
    $secret = get_billing_portal_hmac_secret();
    $secret_present = (bool) $secret;

    $token_ready = false;
    if ($secret_present) {
        $token = jpv_billing_portal_build_token('healthcheck@example.com', JPV_BILLING_PORTAL_DEFAULT_RETURN_URL, $secret);
        $token_ready = is_string($token) && strpos($token, '.') !== false;
    }

    return new WP_REST_Response(array(
        'ok' => $secret_present && $token_ready,
        'secret_present' => $secret_present,
        'token_ready' => $token_ready,
    ), 200);
}

function jpv_billing_portal_register_health_route(): void {
    register_rest_route('jpv/v1', '/billing-secret', array(
        'methods' => 'GET',
        'callback' => 'jpv_billing_portal_health_check',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ));
}
add_action('rest_api_init', 'jpv_billing_portal_register_health_route');
