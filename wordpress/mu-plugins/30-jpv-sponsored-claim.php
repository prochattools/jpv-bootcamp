<?php
/**
 * MU Plugin: Sponsored claim handoff (JPV)
 *
 * URL:
 * - https://portal.jpvbootcamp.com/go/sponsored-claim?token=...
 */

if (!defined('ABSPATH')) {
    exit;
}

const JPV_SPONSORED_CLAIM_DEFAULT_NEXT = 'https://jpvbootcamp.com';
const JPV_SPONSORED_CLAIM_DEFAULT_PORTAL = 'https://portal.jpvbootcamp.com';
const JPV_SPONSORED_CLAIM_MAX_AGE = 604800; // 7 days
const JPV_SPONSORED_CLAIM_SKEW = 300; // 5 minutes

function jpv_sponsored_claim_get_env(string $key): string {
    $env = getenv($key);
    if ($env !== false && trim((string) $env) !== '') {
        return trim((string) $env);
    }
    if (!empty($_ENV[$key])) {
        return trim((string) $_ENV[$key]);
    }
    if (!empty($_SERVER[$key])) {
        return trim((string) $_SERVER[$key]);
    }
    if (defined($key) && constant($key)) {
        return trim((string) constant($key));
    }
    return '';
}

function jpv_sponsored_claim_no_cache(): void {
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

function jpv_sponsored_claim_base64url_decode(string $value) {
    $base64 = strtr($value, '-_', '+/');
    $padLength = strlen($base64) % 4;
    if ($padLength > 0) {
        $base64 .= str_repeat('=', 4 - $padLength);
    }
    $decoded = base64_decode($base64, true);
    return $decoded === false ? null : $decoded;
}

function jpv_sponsored_claim_verify_token(string $token, string $secret): array {
    $token = trim(str_replace(array("\r", "\n"), '', $token));
    if ($token === '') {
        return array('ok' => false, 'reason' => 'missing');
    }
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return array('ok' => false, 'reason' => 'malformed');
    }

    $payloadB64 = $parts[0];
    $sigB64 = $parts[1];
    $payloadJson = jpv_sponsored_claim_base64url_decode($payloadB64);
    $sig = jpv_sponsored_claim_base64url_decode($sigB64);
    if ($payloadJson === null || $sig === null) {
        return array('ok' => false, 'reason' => 'decode_error');
    }

    $expected = hash_hmac('sha256', $payloadB64, $secret, true);
    if (!hash_equals($expected, $sig)) {
        return array('ok' => false, 'reason' => 'bad_sig');
    }

    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) {
        return array('ok' => false, 'reason' => 'invalid_payload');
    }

    $iat = isset($payload['iat']) ? (int) $payload['iat'] : 0;
    $exp = isset($payload['exp']) ? (int) $payload['exp'] : 0;
    if ($iat <= 0 || $exp <= 0 || $exp < $iat) {
        return array('ok' => false, 'reason' => 'invalid_payload');
    }

    $now = time();
    if ($exp < ($now - JPV_SPONSORED_CLAIM_SKEW)) {
        return array('ok' => false, 'reason' => 'expired');
    }

    if (($exp - $iat) > JPV_SPONSORED_CLAIM_MAX_AGE) {
        return array('ok' => false, 'reason' => 'invalid_payload');
    }

    if ($iat > ($now + JPV_SPONSORED_CLAIM_SKEW)) {
        return array('ok' => false, 'reason' => 'iat_in_future');
    }

    if (($now - $iat) > (JPV_SPONSORED_CLAIM_MAX_AGE + JPV_SPONSORED_CLAIM_SKEW)) {
        return array('ok' => false, 'reason' => 'iat_too_old');
    }

    return array('ok' => true);
}

function jpv_sponsored_claim_handle(): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($uri === '') {
        return;
    }
    $path = wp_parse_url($uri, PHP_URL_PATH);
    if (!$path || $path !== '/go/sponsored-claim') {
        return;
    }

    $token = isset($_GET['token']) ? (string) $_GET['token'] : '';
    $secret = jpv_sponsored_claim_get_env('SPONSORED_CLAIM_SECRET');
    $portalBase = jpv_sponsored_claim_get_env('SPONSORED_PORTAL_BASE_URL');
    $portalBase = $portalBase !== '' ? rtrim($portalBase, '/') : JPV_SPONSORED_CLAIM_DEFAULT_PORTAL;

    if ($secret === '') {
        error_log('[JPV Sponsored Claim] missing_secret');
        jpv_sponsored_claim_no_cache();
        wp_safe_redirect($portalBase, 302);
        exit;
    }

    $verification = jpv_sponsored_claim_verify_token($token, $secret);
    if (empty($verification['ok'])) {
        $reason = isset($verification['reason']) ? $verification['reason'] : 'invalid';
        error_log('[JPV Sponsored Claim] token_verify_failed reason=' . $reason);
        jpv_sponsored_claim_no_cache();
        wp_safe_redirect($portalBase, 302);
        exit;
    }

    if (!is_user_logged_in()) {
        $goUrl = $portalBase . '/go/sponsored-claim?token=' . rawurlencode($token);
        $loginUrl = wp_login_url($goUrl);
        jpv_sponsored_claim_no_cache();
        wp_safe_redirect($loginUrl, 302);
        exit;
    }

    $nextBase = jpv_sponsored_claim_get_env('APP_BASE_URL');
    $nextBase = $nextBase !== '' ? rtrim($nextBase, '/') : JPV_SPONSORED_CLAIM_DEFAULT_NEXT;
    $target = $nextBase . '/sponsored/claim?token=' . rawurlencode($token);
    jpv_sponsored_claim_no_cache();
    wp_safe_redirect($target, 302);
    exit;
}
add_action('init', 'jpv_sponsored_claim_handle', 0);
