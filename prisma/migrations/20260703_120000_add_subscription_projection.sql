-- Add subscription projection fields to customer_provisioning
-- Supports webhook-driven subscription state reconciliation and billing communications

ALTER TABLE customer_provisioning
ADD COLUMN stripe_price_id TEXT,
ADD COLUMN subscription_status TEXT,
ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN subscription_cancel_at_period_end BOOLEAN,
ADD COLUMN subscription_updated_at TIMESTAMP WITH TIME ZONE;
