<?php
/**
 * Plugin Name: JPV Provisioning
 * Description: Provision WordPress users via a secure REST endpoint.
 * Version: 0.1.0
 * Author: JPV Bootcamp
 */

if (!defined('ABSPATH')) {
    exit;
}

const JPV_PROVISIONING_OPTION = 'jpv_provisioning_token';

function jpv_provisioning_get_token() {
    if (defined('JPV_PROVISION_TOKEN') && JPV_PROVISION_TOKEN) {
        return JPV_PROVISION_TOKEN;
    }

    return get_option(JPV_PROVISIONING_OPTION);
}

function jpv_provisioning_register_routes() {
    register_rest_route('jpv/v1', '/provision', array(
        'methods' => 'POST',
        'callback' => 'jpv_provisioning_handle_request',
        'permission_callback' => 'jpv_provisioning_check_auth',
    ));
}
add_action('rest_api_init', 'jpv_provisioning_register_routes');

function jpv_provisioning_check_auth($request) {
    $header = $request->get_header('authorization');
    if (!$header) {
        return new WP_Error('jpv_missing_auth', 'Missing authorization header.', array('status' => 401));
    }

    if (!preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
        return new WP_Error('jpv_invalid_auth', 'Invalid authorization header.', array('status' => 401));
    }

    $provided = trim($matches[1]);
    $expected = jpv_provisioning_get_token();

    if (!$expected || !hash_equals($expected, $provided)) {
        return new WP_Error('jpv_forbidden', 'Unauthorized.', array('status' => 401));
    }

    return true;
}

function jpv_provisioning_handle_request(WP_REST_Request $request) {
    $params = $request->get_json_params();

    $email = isset($params['email']) ? sanitize_email($params['email']) : '';
    $plan = isset($params['plan']) ? sanitize_text_field($params['plan']) : '';
    $name = isset($params['name']) ? sanitize_text_field($params['name']) : '';
    $stripe_customer_id = '';

    if (isset($params['stripe_customer_id'])) {
        $stripe_customer_id = sanitize_text_field($params['stripe_customer_id']);
    } elseif (isset($params['stripeCustomerId'])) {
        $stripe_customer_id = sanitize_text_field($params['stripeCustomerId']);
    }

    if (!is_email($email)) {
        return new WP_REST_Response(array('error' => 'Invalid email address.'), 400);
    }

    $plan = strtolower(trim($plan));
    if ($plan === '') {
        return new WP_REST_Response(array('error' => 'Plan is required.'), 400);
    }

    $allowed_plans = array('pro', 'vip', 'none');
    if (!in_array($plan, $allowed_plans, true)) {
        return new WP_REST_Response(array('error' => 'Invalid plan.'), 400);
    }

    $user = get_user_by('email', $email);
    $user_id = $user ? $user->ID : 0;

    if (!$user_id) {
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

        if ($name) {
            $parts = preg_split('/\s+/', trim($name));
            if ($parts && count($parts) > 0) {
                $user_data['first_name'] = $parts[0];
                if (count($parts) > 1) {
                    $user_data['last_name'] = implode(' ', array_slice($parts, 1));
                }
            }
            $user_data['display_name'] = $name;
        }

        $user_id = wp_insert_user($user_data);
        if (is_wp_error($user_id)) {
            return new WP_REST_Response(array('error' => 'Failed to create user.'), 500);
        }
    } else {
        $user_obj = new WP_User($user_id);
        if ($user_obj && !$user_obj->has_cap('subscriber')) {
            $user_obj->set_role('subscriber');
        }
    }

    update_user_meta($user_id, 'jpv_membership_level', $plan);
    if ($stripe_customer_id) {
        update_user_meta($user_id, 'jpv_stripe_customer_id', $stripe_customer_id);
    }

    $user_for_reset = get_user_by('id', $user_id);
    if (!$user_for_reset) {
        return new WP_REST_Response(array('error' => 'User not found after provisioning.'), 500);
    }

    $reset_key = get_password_reset_key($user_for_reset);
    if (is_wp_error($reset_key)) {
        return new WP_REST_Response(array('error' => 'Failed to generate reset link.'), 500);
    }

    $reset_link = network_site_url(
        'wp-login.php?action=rp&key=' . rawurlencode($reset_key) . '&login=' . rawurlencode($user_for_reset->user_login),
        'login'
    );

    return rest_ensure_response(array(
        'ok' => true,
        'wp_user_id' => $user_id,
        'reset_link' => $reset_link,
    ));
}

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

    $token = jpv_provisioning_get_token();
    ?>
    <div class="wrap">
        <h1>JPV Provisioning</h1>
        <p>Set the bearer token used by the Next.js app when calling the provisioning endpoint.</p>
        <?php if (defined('JPV_PROVISION_TOKEN') && JPV_PROVISION_TOKEN) : ?>
            <div class="notice notice-info">
                <p>JPV_PROVISION_TOKEN is defined in wp-config.php and overrides this setting.</p>
            </div>
        <?php endif; ?>
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
