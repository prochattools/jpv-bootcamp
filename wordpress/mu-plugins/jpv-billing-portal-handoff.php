<?php
/**
 * MU Plugin: Billing portal signed handoff (JPV)
 *
 * Deprecated wrapper: use 10-jpv-billing-portal-handoff.php instead.
 */

if (!defined('ABSPATH')) {
    exit;
}

$target = __DIR__ . '/10-jpv-billing-portal-handoff.php';
if (file_exists($target)) {
    require_once $target;
}
