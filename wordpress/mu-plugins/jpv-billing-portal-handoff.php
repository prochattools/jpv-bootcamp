<?php
/**
 * MU Plugin: Billing portal signed handoff (JPV)
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

        $return_url = jpv_billing_portal_extract_return_url($item->url);
        $token = jpv_billing_portal_build_token($email, $return_url, $secret);
        $item->url = jpv_billing_portal_build_url($token);
    }

    if ($found_target && !$secret) {
        jpv_billing_portal_log_missing_secret_once();
    }

    return array_values($items);
}
add_filter('wp_nav_menu_objects', 'jpv_billing_portal_filter_menu_items', 10, 2);

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
