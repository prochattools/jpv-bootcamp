<?php
/**
 * MU Plugin: Partners handoff (JPV)
 *
 * Endpoint:
 * - https://portal.jpvbootcamp.com/go/partners
 *
 * This file is stored in the Next.js repo for manual deployment to WordPress; it is not auto-deployed.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JPV_PARTNERS_HANDOFF_TARGET = 'https://jpvbootcamp.com/partners';
const JPV_PARTNERS_HANDOFF_FALLBACK = 'https://portal.jpvbootcamp.com/community/';

function jpv_partners_handoff_log_event(string $event, array $payload = array()): void {
    $payload['event'] = $event;
    $payload['ts'] = time();
    error_log('[JPV Partners Handoff] ' . wp_json_encode($payload));
}

function jpv_partners_handoff_redact_email(string $email): string {
    if (!is_email($email)) {
        return '';
    }
    $parts = explode('@', $email);
    $local = $parts[0] ?? '';
    $domain = $parts[1] ?? '';
    $tail = $local !== '' ? substr($local, -2) : '';
    return '***' . $tail . '@' . $domain;
}

function jpv_partners_handoff_get_secret(): ?string {
    $env = getenv('PARTNERS_HANDOFF_SECRET');
    if ($env !== false && trim((string) $env) !== '') {
        return trim((string) $env);
    }

    if (!empty($_ENV['PARTNERS_HANDOFF_SECRET'])) {
        return trim((string) $_ENV['PARTNERS_HANDOFF_SECRET']);
    }

    if (!empty($_SERVER['PARTNERS_HANDOFF_SECRET'])) {
        return trim((string) $_SERVER['PARTNERS_HANDOFF_SECRET']);
    }

    if (defined('PARTNERS_HANDOFF_SECRET') && PARTNERS_HANDOFF_SECRET) {
        return trim((string) PARTNERS_HANDOFF_SECRET);
    }

    return null;
}

function jpv_partners_handoff_base64url_encode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function jpv_partners_handoff_random_nonce(): string {
    try {
        return bin2hex(random_bytes(12));
    } catch (Throwable $e) {
        return wp_generate_password(16, false, false);
    }
}

function jpv_partners_handoff_build_token(array $payload, string $secret): string {
    $payload_json = wp_json_encode($payload);
    $payload_b64 = jpv_partners_handoff_base64url_encode($payload_json);
    $signature = hash_hmac('sha256', $payload_b64, $secret, true);
    $signature_b64 = jpv_partners_handoff_base64url_encode($signature);
    return $payload_b64 . '.' . $signature_b64;
}

function jpv_partners_handoff_should_handle(string $path): bool {
    if ($path === '/go/partners' || $path === '/go/partners/') {
        return true;
    }
    return false;
}

function jpv_partners_handoff_handle_request(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }

    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path || !jpv_partners_handoff_should_handle($path)) {
        return;
    }

    $logged_in = is_user_logged_in();
    $secret = jpv_partners_handoff_get_secret();
    $has_secret = $secret ? true : false;
    jpv_partners_handoff_log_event('request_seen', array(
        'path' => $path,
        'logged_in' => $logged_in,
        'has_secret' => $has_secret,
    ));

    if (function_exists('nocache_headers')) {
        nocache_headers();
    }

    if (!$logged_in) {
        $login_url = wp_login_url(home_url('/go/partners'));
        jpv_partners_handoff_log_event('login_required', array(
            'logged_in' => false,
            'has_secret' => $has_secret,
        ));
        wp_safe_redirect($login_url, 302);
        exit;
    }

    if (!$secret) {
        jpv_partners_handoff_log_event('missing_secret', array(
            'logged_in' => true,
            'has_secret' => false,
        ));
        wp_safe_redirect(JPV_PARTNERS_HANDOFF_FALLBACK, 302);
        exit;
    }

    $user = wp_get_current_user();
    $email = $user && isset($user->user_email) ? $user->user_email : '';
    if (!is_email($email)) {
        jpv_partners_handoff_log_event('invalid_email', array(
            'logged_in' => true,
            'has_secret' => true,
            'userId' => $user ? $user->ID : null,
        ));
        wp_safe_redirect(JPV_PARTNERS_HANDOFF_FALLBACK, 302);
        exit;
    }

    $name = $user && $user->display_name ? $user->display_name : '';
    if ($name === '' && $user && $user->user_login) {
        $name = $user->user_login;
    }

    $issued_at = time();
    $payload = array(
        'wp_user_id' => (int) $user->ID,
        'wp_email' => $email,
        'wp_name' => $name !== '' ? $name : 'Member',
        'iat' => $issued_at,
        'exp' => $issued_at + 300,
        'nonce' => jpv_partners_handoff_random_nonce(),
    );

    $token = jpv_partners_handoff_build_token($payload, $secret);
    $target = add_query_arg('token', $token, JPV_PARTNERS_HANDOFF_TARGET);

    jpv_partners_handoff_log_event('handoff_redirect', array(
        'logged_in' => true,
        'has_secret' => true,
        'userId' => (int) $user->ID,
        'email' => jpv_partners_handoff_redact_email($email),
    ));

    wp_safe_redirect($target, 302);
    exit;
}
add_action('init', 'jpv_partners_handoff_handle_request', 0);
