<?php
/**
 * Plugin Name: JPV Provisioning
 * Description: Provision WordPress users via a secure REST endpoint.
 * Version: 0.6.0
 * Author: JPV Bootcamp
 *
 * This file is stored in the Next.js repo for manual deployment to WordPress; it is not auto-deployed.
 */

if (!defined('ABSPATH')) {
    exit;
}

const JPV_PROVISIONING_OPTION = 'jpv_provision_token';
const JPV_PROVISIONING_LEGACY_OPTION = 'jpv_provisioning_token';
const JPV_PROVISIONING_MAIL_FROM = 'support@jpvbootcamp.com';
const JPV_PROVISIONING_MAIL_FROM_NAME = 'JPV Bootcamp Support';

function jpv_provisioning_mail_from($from) {
    return JPV_PROVISIONING_MAIL_FROM;
}

function jpv_provisioning_mail_from_name($name) {
    return JPV_PROVISIONING_MAIL_FROM_NAME;
}

function jpv_provisioning_log_event(string $event, array $payload = array()): void {
    $payload['event'] = $event;
    $payload['ts'] = time();
    error_log('[JPV Provisioning] ' . wp_json_encode($payload));
}

function jpv_provisioning_send_new_user_email(int $user_id, string $email): void {
    add_filter('wp_mail_from', 'jpv_provisioning_mail_from');
    add_filter('wp_mail_from_name', 'jpv_provisioning_mail_from_name');

    try {
        $result = null;
        if (function_exists('wp_new_user_notification')) {
            $result = wp_new_user_notification($user_id, null, 'user');
        }

        if ($result === false) {
            jpv_provisioning_log_event('email_sent_failed', array(
                'userId' => $user_id,
                'email' => $email,
                'method' => 'wp_new_user_notification',
                'reason' => 'wp_mail_failed',
            ));
        } else {
            jpv_provisioning_log_event('email_sent_success', array(
                'userId' => $user_id,
                'email' => $email,
                'method' => 'wp_new_user_notification',
            ));
        }
    } catch (Throwable $e) {
        jpv_provisioning_log_event('email_sent_failed', array(
            'userId' => $user_id,
            'email' => $email,
            'method' => 'wp_new_user_notification',
            'reason' => 'exception',
            'error' => $e->getMessage(),
        ));
    }

    remove_filter('wp_mail_from', 'jpv_provisioning_mail_from');
    remove_filter('wp_mail_from_name', 'jpv_provisioning_mail_from_name');
}

function jpv_provisioning_get_token_sources(): array {
    $option = get_option(JPV_PROVISIONING_OPTION);
    $option = $option ? trim((string) $option) : '';

    if ($option === '') {
        $legacy = get_option(JPV_PROVISIONING_LEGACY_OPTION);
        $legacy = $legacy ? trim((string) $legacy) : '';
        if ($legacy !== '') {
            $option = $legacy;
            update_option(JPV_PROVISIONING_OPTION, $legacy, false);
        }
    }

    $wp_const = '';
    if (defined('WP_PROVISION_TOKEN') && WP_PROVISION_TOKEN) {
        $wp_const = trim((string) WP_PROVISION_TOKEN);
    }

    $wp_env = getenv('WP_PROVISION_TOKEN');
    $wp_env = $wp_env ? trim((string) $wp_env) : '';

    $const = '';
    if (defined('JPV_PROVISION_TOKEN') && JPV_PROVISION_TOKEN) {
        $const = trim((string) JPV_PROVISION_TOKEN);
    }

    $env = getenv('JPV_PROVISION_TOKEN');
    $env = $env ? trim((string) $env) : '';

    $checked = array(
        'option' => $option !== '',
        'wp_const' => $wp_const !== '',
        'wp_env' => $wp_env !== '',
        'const' => $const !== '',
        'env' => $env !== '',
    );

    $token = $option !== ''
        ? $option
        : ($wp_const !== ''
            ? $wp_const
            : ($wp_env !== ''
                ? $wp_env
                : ($const !== ''
                    ? $const
                    : ($env !== '' ? $env : ''))));

    return array($token, $checked);
}

function jpv_provisioning_get_app_sync_token() {
    if (defined('JPV_APP_SYNC_TOKEN') && JPV_APP_SYNC_TOKEN) {
        return JPV_APP_SYNC_TOKEN;
    }

    if (defined('WP_PROVISION_TOKEN') && WP_PROVISION_TOKEN) {
        return WP_PROVISION_TOKEN;
    }

    if (defined('JPV_PROVISION_TOKEN') && JPV_PROVISION_TOKEN) {
        return JPV_PROVISION_TOKEN;
    }

    return '';
}

function jpv_provisioning_get_app_sync_url() {
    if (defined('JPV_APP_SYNC_URL') && JPV_APP_SYNC_URL) {
        return JPV_APP_SYNC_URL;
    }

    return '';
}

function jpv_provisioning_find_header(array $headers, string $key): string {
    foreach ($headers as $header_key => $header_value) {
        if (strcasecmp((string) $header_key, $key) === 0) {
            return (string) $header_value;
        }
    }

    return '';
}

function jpv_provisioning_get_auth_header(WP_REST_Request $request): string {
    $header = $request->get_header('authorization');
    if ($header) {
        return trim((string) $header);
    }

    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim((string) $_SERVER['HTTP_AUTHORIZATION']);
    }

    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return trim((string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            $value = jpv_provisioning_find_header($headers, 'Authorization');
            if ($value !== '') {
                return trim((string) $value);
            }
        }
    }

    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            $value = jpv_provisioning_find_header($headers, 'Authorization');
            if ($value !== '') {
                return trim((string) $value);
            }
        }
    }

    return '';
}

function jpv_provisioning_extract_bearer_token(string $header): string {
    if ($header === '') {
        return '';
    }

    if (preg_match('/^\s*Bearer\s+(.+)$/i', $header, $matches)) {
        return trim((string) $matches[1]);
    }

    return '';
}

function jpv_provisioning_get_param_value(array $params, array $keys): array {
    foreach ($keys as $key) {
        if (array_key_exists($key, $params)) {
            $value = $params[$key];
            $value = is_string($value) ? $value : '';
            return array(trim(sanitize_text_field($value)), true);
        }
    }

    return array('', false);
}

function jpv_provisioning_extract_name_data(array $params, string $email): array {
    list($first_raw, $first_present) = jpv_provisioning_get_param_value($params, array('firstName', 'first_name'));
    list($last_raw, $last_present) = jpv_provisioning_get_param_value($params, array('lastName', 'last_name'));
    list($full_raw, $full_present) = jpv_provisioning_get_param_value($params, array('fullName', 'full_name', 'name'));

    $first = trim($first_raw);
    $last = trim($last_raw);
    $full = trim($full_raw);

    $name_received = $first_present || $last_present || $full_present;

    if ($first === '' && $last === '' && $full !== '') {
        $parts = preg_split('/\s+/', $full);
        if ($parts && count($parts) > 0) {
            $first = array_shift($parts);
            $last = trim(implode(' ', $parts));
        }
    }

    $display_name = trim($first . ' ' . $last);
    if ($display_name === '' && $full !== '') {
        $display_name = $full;
    }

    $fallback_display = '';
    if ($email) {
        $local_part = strstr($email, '@', true);
        $fallback_display = $local_part !== false ? $local_part : $email;
        $fallback_display = trim((string) $fallback_display);
    }

    return array(
        'first_name' => $first,
        'last_name' => $last,
        'display_name' => $display_name,
        'fallback_display_name' => $fallback_display,
        'name_received' => $name_received,
    );
}

function jpv_provisioning_require_auth(WP_REST_Request $request): array {
    list($expected, $checked) = jpv_provisioning_get_token_sources();

    if ($expected === '') {
        return array(
            'authorized' => false,
            'response' => new WP_REST_Response(
                array(
                    'ok' => false,
                    'reason' => 'server_misconfigured',
                    'missing' => 'provision_token',
                    'checked' => $checked,
                ),
                500
            ),
        );
    }

    $header = jpv_provisioning_get_auth_header($request);
    $provided = jpv_provisioning_extract_bearer_token($header);

    if ($provided === '' || !hash_equals($expected, $provided)) {
        return array(
            'authorized' => false,
            'response' => new WP_REST_Response(
                array(
                    'ok' => false,
                    'reason' => 'unauthorized',
                ),
                401
            ),
        );
    }

    return array('authorized' => true);
}

function jpv_provisioning_register_routes() {
    register_rest_route('jpv/v1', '/provision', array(
        'methods' => 'POST',
        'callback' => 'jpv_provisioning_handle_request',
        'permission_callback' => '__return_true',
    ), true);

    register_rest_route('jpv/v1', '/user-exists', array(
        'methods' => 'GET',
        'callback' => 'jpv_provisioning_handle_user_exists',
        'permission_callback' => '__return_true',
    ), true);
}
add_action('rest_api_init', 'jpv_provisioning_register_routes', 99);

function jpv_provisioning_handle_user_exists(WP_REST_Request $request) {
    $auth = jpv_provisioning_require_auth($request);
    if (!$auth['authorized']) {
        return $auth['response'];
    }

    $wp_user_id = absint($request->get_param('wp_user_id'));
    $email = $request->get_param('email');
    $email = $email ? sanitize_email($email) : '';

    if (!$wp_user_id && !$email) {
        return new WP_REST_Response(array('ok' => false, 'reason' => 'missing_identifier'), 400);
    }

    if ($email && !is_email($email)) {
        return new WP_REST_Response(array('ok' => false, 'reason' => 'invalid_email'), 400);
    }

    $user = null;
    if ($wp_user_id) {
        $user = get_user_by('id', $wp_user_id);
    } elseif ($email) {
        $user = get_user_by('email', $email);
    }

    if (!$user) {
        return rest_ensure_response(array('ok' => true, 'exists' => false));
    }

    return rest_ensure_response(array(
        'ok' => true,
        'exists' => true,
        'wp_user_id' => $user->ID,
        'email' => $user->user_email,
    ));
}

function jpv_provisioning_handle_request(WP_REST_Request $request) {
    $auth = jpv_provisioning_require_auth($request);
    if (!$auth['authorized']) {
        return $auth['response'];
    }

    $params = $request->get_json_params();
    if (!is_array($params)) {
        $params = array();
    }

    $email = isset($params['email']) ? sanitize_email($params['email']) : '';
    $plan_raw = isset($params['plan']) ? sanitize_text_field($params['plan']) : '';
    $name_data = jpv_provisioning_extract_name_data($params, $email);
    $name_received = $name_data['name_received'];
    $name_set = false;

    $customer_id = '';
    if (isset($params['customerId'])) {
        $customer_id = sanitize_text_field($params['customerId']);
    } elseif (isset($params['stripe_customer_id'])) {
        $customer_id = sanitize_text_field($params['stripe_customer_id']);
    } elseif (isset($params['stripeCustomerId'])) {
        $customer_id = sanitize_text_field($params['stripeCustomerId']);
    }

    $subscription_id = '';
    if (isset($params['subscriptionId'])) {
        $subscription_id = sanitize_text_field($params['subscriptionId']);
    } elseif (isset($params['stripe_subscription_id'])) {
        $subscription_id = sanitize_text_field($params['stripe_subscription_id']);
    } elseif (isset($params['stripeSubscriptionId'])) {
        $subscription_id = sanitize_text_field($params['stripeSubscriptionId']);
    }

    if (!is_email($email)) {
        return new WP_REST_Response(array('ok' => false, 'reason' => 'invalid_email'), 400);
    }

    $plan_meta = null;
    if ($plan_raw !== '') {
        $plan_norm = strtolower(trim($plan_raw));
        if ($plan_norm === 'pro' || $plan_norm === 'vip') {
            $plan_meta = $plan_norm;
        } elseif ($plan_norm === 'free' || $plan_norm === 'none') {
            $plan_meta = '';
        } else {
            return new WP_REST_Response(array('ok' => false, 'reason' => 'invalid_plan'), 400);
        }
    }

    $user = get_user_by('email', $email);
    $user_id = $user ? $user->ID : 0;
    $created = false;

    if (!$user_id) {
        $display_name = $name_data['display_name'];
        if ($display_name === '') {
            $display_name = $name_data['fallback_display_name'];
        }

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

        if ($name_data['first_name'] !== '') {
            $user_data['first_name'] = $name_data['first_name'];
        }

        if ($name_data['last_name'] !== '') {
            $user_data['last_name'] = $name_data['last_name'];
        }

        if ($display_name !== '') {
            $user_data['display_name'] = $display_name;
            $user_data['nickname'] = $display_name;
            $name_set = true;
        }

        if (!$name_set && ($name_data['first_name'] !== '' || $name_data['last_name'] !== '')) {
            $name_set = true;
        }

        $user_id = wp_insert_user($user_data);
        if (is_wp_error($user_id)) {
            return new WP_REST_Response(array('ok' => false, 'reason' => 'create_failed'), 500);
        }

        $created = true;

        jpv_provisioning_log_event('user_created', array(
            'userId' => $user_id,
            'email' => $email,
            'plan' => $plan_meta,
        ));

        jpv_provisioning_send_new_user_email((int) $user_id, $email);
    } else {
        error_log('existing_user_no_role_change');
        if ($name_received) {
            if ($name_data['first_name'] !== '') {
                update_user_meta($user_id, 'first_name', $name_data['first_name']);
                $name_set = true;
            }

            if ($name_data['last_name'] !== '') {
                update_user_meta($user_id, 'last_name', $name_data['last_name']);
                $name_set = true;
            }

            if ($name_data['display_name'] !== '') {
                wp_update_user(array(
                    'ID' => $user_id,
                    'display_name' => $name_data['display_name'],
                    'nickname' => $name_data['display_name'],
                ));
                $name_set = true;
            }

            if ($name_set) {
                error_log('existing_user_name_updated userId=' . $user_id);
            }
        }
    }

    $effective_plan = $plan_meta;
    if ($effective_plan === null && $created) {
        $effective_plan = '';
    }

    if ($effective_plan !== null) {
        update_user_meta($user_id, 'jpv_membership_level', $effective_plan);
    }

    if ($customer_id !== '') {
        update_user_meta($user_id, 'jpv_stripe_customer_id', $customer_id);
    }

    if ($subscription_id !== '') {
        update_user_meta($user_id, 'jpv_stripe_subscription_id', $subscription_id);
    }

    $user_for_reset = get_user_by('id', $user_id);
    if (!$user_for_reset) {
        return new WP_REST_Response(array('ok' => false, 'reason' => 'user_not_found'), 500);
    }

    $reset_key = get_password_reset_key($user_for_reset);
    if (is_wp_error($reset_key)) {
        return new WP_REST_Response(array('ok' => false, 'reason' => 'reset_link_failed'), 500);
    }

    $reset_link = network_site_url(
        'wp-login.php?action=rp&key=' . rawurlencode($reset_key) . '&login=' . rawurlencode($user_for_reset->user_login),
        'login'
    );

    return rest_ensure_response(array(
        'ok' => true,
        'wp_user_id' => $user_id,
        'reset_link' => $reset_link,
        'name_received' => $name_received,
        'name_set' => $name_set,
    ));
}

function jpv_provisioning_notify_deletion($user_id) {
    $url = jpv_provisioning_get_app_sync_url();
    $token = jpv_provisioning_get_app_sync_token();

    if (!$url || !$token) {
        error_log('JPV provisioning deletion sync skipped: missing app sync URL or token.');
        return;
    }

    $user = get_userdata($user_id);
    $email = $user && isset($user->user_email) ? $user->user_email : '';

    if (!$email) {
        error_log('JPV provisioning deletion sync skipped: missing user email.');
        return;
    }

    $payload = array(
        'wp_user_id' => (int) $user_id,
        'email' => $email,
    );

    $response = wp_remote_post($url, array(
        'method' => 'POST',
        'headers' => array(
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
        ),
        'body' => wp_json_encode($payload),
        'timeout' => 5,
    ));

    if (is_wp_error($response)) {
        error_log('JPV provisioning deletion sync failed: ' . $response->get_error_message());
        return;
    }

    $status = wp_remote_retrieve_response_code($response);
    if ($status < 200 || $status >= 300) {
        error_log('JPV provisioning deletion sync failed with status ' . $status);
    }
}
add_action('delete_user', 'jpv_provisioning_notify_deletion', 10, 1);

function jpv_provisioning_register_settings() {
    register_setting('jpv_provisioning', JPV_PROVISIONING_OPTION);
}
add_action('admin_init', 'jpv_provisioning_register_settings');

function jpv_provisioning_add_settings_page() {
    add_options_page(
        'JPV Provisioning',
        'JPV Provisioning',
        'manage_options',
        'jpv-provisioning',
        'jpv_provisioning_render_settings_page'
    );
}
add_action('admin_menu', 'jpv_provisioning_add_settings_page');

function jpv_provisioning_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $token = get_option(JPV_PROVISIONING_OPTION);
    $token = $token ? (string) $token : '';
    ?>
    <div class="wrap">
        <h1>JPV Provisioning</h1>
        <p>Set the bearer token used by the Next.js app when calling the provisioning endpoint.</p>
        <form method="post" action="options.php">
            <?php settings_fields('jpv_provisioning'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="<?php echo esc_attr(JPV_PROVISIONING_OPTION); ?>">Provisioning token</label></th>
                    <td>
                        <input
                            type="text"
                            id="<?php echo esc_attr(JPV_PROVISIONING_OPTION); ?>"
                            name="<?php echo esc_attr(JPV_PROVISIONING_OPTION); ?>"
                            value="<?php echo esc_attr($token); ?>"
                            class="regular-text"
                            autocomplete="off"
                        />
                    </td>
                </tr>
            </table>
            <?php submit_button('Save token'); ?>
        </form>
    </div>
    <?php
}
