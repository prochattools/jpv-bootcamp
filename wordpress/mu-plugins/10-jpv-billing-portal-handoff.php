<?php
/**
 * MU Plugin: Billing portal signed handoff (JPV)
 *
 * Menu URLs:
 * - https://portal.jpvbootcamp.com/go/billing-portal
 * - https://portal.jpvbootcamp.com/go/upgrade-pro
 * - https://portal.jpvbootcamp.com/go/upgrade-vip
 *
 * This file is stored in the Next.js repo for manual deployment to WordPress; it is not auto-deployed.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JPV_BILLING_PORTAL_API_URL = 'https://jpvbootcamp.com/api/stripe/billing-portal';
const JPV_UPGRADE_PRO_API_URL = 'https://jpvbootcamp.com/api/stripe/checkout?plan=pro';
const JPV_UPGRADE_VIP_API_URL = 'https://jpvbootcamp.com/api/stripe/upgrade-vip';
const JPV_BILLING_PORTAL_DEFAULT_RETURN_URL = 'https://portal.jpvbootcamp.com/community/';
const JPV_BILLING_PORTAL_FALLBACK_URL = 'https://jpvbootcamp.com/upgrade';
const JPV_BILLING_PORTAL_MAX_RETURN_LENGTH = 2048;

function jpv_billing_portal_allow_redirect_hosts(array $hosts): array {
    $hosts[] = 'jpvbootcamp.com';
    $hosts[] = 'www.jpvbootcamp.com';
    $hosts[] = 'pay.stripe.com';
    return array_values(array_unique($hosts));
}
add_filter('allowed_redirect_hosts', 'jpv_billing_portal_allow_redirect_hosts');

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

function jpv_billing_portal_strip_crlf(string $value): string {
    return str_replace(array("\r", "\n"), '', $value);
}

function jpv_billing_portal_has_unsafe_scheme(string $value): bool {
    $lower = strtolower(trim($value));
    return strpos($lower, 'javascript:') === 0 || strpos($lower, 'data:') === 0;
}

function jpv_billing_portal_validate_return_url($raw): array {
    $present = $raw !== null && trim((string) $raw) !== '';
    if (!$present) {
        return array(
            'url' => JPV_BILLING_PORTAL_DEFAULT_RETURN_URL,
            'present' => false,
            'valid' => false,
            'host' => '',
            'path' => '/community/',
        );
    }

    $candidate = trim((string) $raw);
    $candidate = jpv_billing_portal_strip_crlf($candidate);
    if (strlen($candidate) > JPV_BILLING_PORTAL_MAX_RETURN_LENGTH || jpv_billing_portal_has_unsafe_scheme($candidate)) {
        return array(
            'url' => JPV_BILLING_PORTAL_DEFAULT_RETURN_URL,
            'present' => true,
            'valid' => false,
            'host' => '',
            'path' => '/community/',
        );
    }
    $decoded = rawurldecode($candidate);
    $decoded = jpv_billing_portal_strip_chained_url($decoded);

    $parts = wp_parse_url($decoded);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return array(
            'url' => JPV_BILLING_PORTAL_DEFAULT_RETURN_URL,
            'present' => true,
            'valid' => false,
            'host' => '',
            'path' => '/community/',
        );
    }

    $origin = $parts['scheme'] . '://' . $parts['host'];
    if (!empty($parts['port'])) {
        $origin .= ':' . $parts['port'];
    }

    $allowed = array('https://portal.jpvbootcamp.com', 'https://jpvbootcamp.com', 'https://www.jpvbootcamp.com');
    $valid = $parts['scheme'] === 'https' && in_array($origin, $allowed, true);
    $path = isset($parts['path']) ? (string) $parts['path'] : '/';

    return array(
        'url' => $valid ? $decoded : JPV_BILLING_PORTAL_DEFAULT_RETURN_URL,
        'present' => true,
        'valid' => $valid,
        'host' => isset($parts['host']) ? (string) $parts['host'] : '',
        'path' => $path !== '' ? $path : '/',
    );
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
    error_log('[JPV Billing Portal] BILLING_PORTAL_HMAC_SECRET missing; redirect disabled.');
}

function jpv_billing_portal_send_headers(
    string $handler,
    string $path,
    bool $logged_in,
    bool $has_secret,
    string $target,
    string $why
): void {
    if (headers_sent()) {
        return;
    }
    if (function_exists('nocache_headers')) {
        nocache_headers();
    }
    $safe_target = str_replace(array("\r", "\n"), '', $target);
    header('X-JPV-Billing-Handler: ' . $handler, true);
    header('X-JPV-Billing-User: ' . ($logged_in ? 'logged_in' : 'logged_out'), true);
    header('X-JPV-Billing-Secret: ' . ($has_secret ? 'present' : 'missing'), true);
    header('X-JPV-Billing-Why: ' . $why, true);
    header('X-JPV-Billing-Target: ' . substr($safe_target, 0, 120), true);
    header('X-JPV-Billing-Path: ' . substr($path, 0, 120), true);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
}

function jpv_upgrade_send_headers(
    string $handler,
    string $path,
    bool $logged_in,
    bool $has_secret,
    string $target,
    string $why
): void {
    if (headers_sent()) {
        return;
    }
    if (function_exists('nocache_headers')) {
        nocache_headers();
    }
    $safe_target = str_replace(array("\r", "\n"), '', $target);
    header('X-JPV-Upgrade-Handler: ' . $handler, true);
    header('X-JPV-Upgrade-User: ' . ($logged_in ? 'logged_in' : 'logged_out'), true);
    header('X-JPV-Upgrade-Secret: ' . ($has_secret ? 'present' : 'missing'), true);
    header('X-JPV-Upgrade-Why: ' . $why, true);
    header('X-JPV-Upgrade-Target: ' . substr($safe_target, 0, 120), true);
    header('X-JPV-Upgrade-Path: ' . substr($path, 0, 120), true);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
}

function jpv_billing_portal_log_redirect(
    string $handler,
    string $path,
    bool $logged_in,
    bool $has_secret,
    string $why,
    array $return_info
): void {
    error_log('[JPV Billing Portal] ' . wp_json_encode(array(
        'handler' => $handler,
        'path' => $path,
        'logged_in' => $logged_in,
        'has_secret' => $has_secret,
        'reason' => $why,
        'return_present' => !empty($return_info['present']),
        'return_valid' => !empty($return_info['valid']),
        'return_host' => isset($return_info['host']) ? $return_info['host'] : '',
        'return_path' => isset($return_info['path']) ? $return_info['path'] : '',
    )));
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

function jpv_billing_portal_path_matches(string $path, string $needle): bool {
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

function jpv_billing_portal_handle_redirect(
    string $handler,
    string $path,
    string $uri,
    string $api_url,
    callable $header_sender
): void {
    $logged_in = is_user_logged_in();
    $secret = get_billing_portal_hmac_secret();
    $has_secret = $secret ? true : false;
    $return_param = isset($_GET['return']) ? (string) $_GET['return'] : null;
    $return_info = jpv_billing_portal_validate_return_url($return_param);
    $return_url = $return_info['url'];

    if (!$logged_in) {
        $go_url = jpv_billing_portal_build_full_url($path);
        $go_url = add_query_arg('return', $return_url, $go_url);
        $login_url = wp_login_url($go_url);
        jpv_billing_portal_log_redirect($handler, $path, $logged_in, $has_secret, 'not_logged_in', $return_info);
        $header_sender($handler, $path, $logged_in, $has_secret, $login_url, 'not_logged_in');
        wp_safe_redirect($login_url, 302);
        exit;
    }

    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    if (!is_email($email)) {
        jpv_billing_portal_log_redirect($handler, $path, $logged_in, $has_secret, 'invalid_email', $return_info);
        $header_sender($handler, $path, $logged_in, $has_secret, JPV_BILLING_PORTAL_FALLBACK_URL, 'invalid_email');
        wp_safe_redirect(JPV_BILLING_PORTAL_FALLBACK_URL, 302);
        exit;
    }

    if (!$secret) {
        jpv_billing_portal_log_missing_secret_once();
        jpv_billing_portal_log_redirect($handler, $path, $logged_in, $has_secret, 'missing_secret', $return_info);
        $header_sender($handler, $path, $logged_in, $has_secret, JPV_BILLING_PORTAL_FALLBACK_URL, 'missing_secret');
        wp_safe_redirect(JPV_BILLING_PORTAL_FALLBACK_URL, 302);
        exit;
    }

    $token = jpv_billing_portal_build_token($email, $return_url, $secret);
    $target = add_query_arg('token', $token, $api_url);

    jpv_billing_portal_log_redirect($handler, $path, $logged_in, $has_secret, 'redirect', $return_info);
    $header_sender($handler, $path, $logged_in, $has_secret, $target, 'redirect');
    wp_safe_redirect($target, 302);
    exit;
}

function jpv_billing_portal_handle_go_endpoint(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path) {
        return;
    }

    if (!jpv_billing_portal_path_matches($path, '/go/billing-portal')) {
        return;
    }

    jpv_billing_portal_handle_redirect(
        'billing-portal',
        $path,
        $uri,
        JPV_BILLING_PORTAL_API_URL,
        'jpv_billing_portal_send_headers'
    );
}
add_action('init', 'jpv_billing_portal_handle_go_endpoint', 0);

function jpv_upgrade_vip_handle_go_endpoint(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path) {
        return;
    }

    if (!jpv_billing_portal_path_matches($path, '/go/upgrade-vip')) {
        return;
    }

    jpv_billing_portal_handle_redirect(
        'upgrade-vip',
        $path,
        $uri,
        JPV_UPGRADE_VIP_API_URL,
        'jpv_upgrade_send_headers'
    );
}
add_action('init', 'jpv_upgrade_vip_handle_go_endpoint', 0);

function jpv_upgrade_pro_handle_go_endpoint(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path) {
        return;
    }

    if (!jpv_billing_portal_path_matches($path, '/go/upgrade-pro')) {
        return;
    }

    $logged_in = is_user_logged_in();
    $secret = get_billing_portal_hmac_secret();
    $has_secret = $secret ? true : false;
    $return_param = isset($_GET['return']) ? (string) $_GET['return'] : null;
    $return_info = jpv_billing_portal_validate_return_url($return_param);
    $return_url = $return_info['url'];

    if (!$logged_in) {
        $go_url = jpv_billing_portal_build_full_url($path);
        $go_url = add_query_arg('return', $return_url, $go_url);
        $login_url = wp_login_url($go_url);
        jpv_billing_portal_log_redirect('upgrade-pro', $path, $logged_in, $has_secret, 'not_logged_in', $return_info);
        jpv_upgrade_send_headers('upgrade-pro', $path, $logged_in, $has_secret, $login_url, 'not_logged_in');
        wp_safe_redirect($login_url, 302);
        exit;
    }

    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    if (!is_email($email)) {
        jpv_billing_portal_log_redirect('upgrade-pro', $path, $logged_in, $has_secret, 'invalid_email', $return_info);
        jpv_upgrade_send_headers('upgrade-pro', $path, $logged_in, $has_secret, JPV_UPGRADE_PRO_API_URL, 'invalid_email');
        wp_safe_redirect(JPV_UPGRADE_PRO_API_URL, 302);
        exit;
    }

    if (!$secret) {
        jpv_billing_portal_log_missing_secret_once();
        jpv_billing_portal_log_redirect('upgrade-pro', $path, $logged_in, $has_secret, 'missing_secret', $return_info);
        jpv_upgrade_send_headers('upgrade-pro', $path, $logged_in, $has_secret, JPV_UPGRADE_PRO_API_URL, 'missing_secret');
        wp_safe_redirect(JPV_UPGRADE_PRO_API_URL, 302);
        exit;
    }

    $token = jpv_billing_portal_build_token($email, $return_url, $secret);
    $target = add_query_arg('token', $token, JPV_UPGRADE_PRO_API_URL);

    jpv_billing_portal_log_redirect('upgrade-pro', $path, $logged_in, $has_secret, 'redirect', $return_info);
    jpv_upgrade_send_headers('upgrade-pro', $path, $logged_in, $has_secret, $target, 'redirect');
    wp_safe_redirect($target, 302);
    exit;
}
add_action('init', 'jpv_upgrade_pro_handle_go_endpoint', 0);
