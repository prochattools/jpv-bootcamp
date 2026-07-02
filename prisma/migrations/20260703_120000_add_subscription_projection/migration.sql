-- Add subscription projection fields to customer_provisioning
ALTER TABLE customer_provisioning ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE customer_provisioning ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE customer_provisioning ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;
ALTER TABLE customer_provisioning ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN;
ALTER TABLE customer_provisioning ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP;

-- Add comments for clarity
COMMENT ON COLUMN customer_provisioning.stripe_price_id IS 'Stripe price ID from subscription.items';
COMMENT ON COLUMN customer_provisioning.subscription_status IS 'Stripe subscription status (e.g., active, past_due, canceled, unpaid)';
COMMENT ON COLUMN customer_provisioning.subscription_current_period_end IS 'Current billing period end time';
COMMENT ON COLUMN customer_provisioning.subscription_cancel_at_period_end IS 'Whether subscription will be canceled at period end';
COMMENT ON COLUMN customer_provisioning.subscription_updated_at IS 'Timestamp of last sync from Stripe';
