-- Align jpvbootcamp.customer_provisioning to expected columns.
-- Adds missing columns/indexes only; no drops.

create schema if not exists jpvbootcamp;

alter table jpvbootcamp.customer_provisioning
  add column if not exists plan text,
  add column if not exists current_plan text,
  add column if not exists last_event_id text;

create index if not exists customer_provisioning_stripe_customer_id_idx
  on jpvbootcamp.customer_provisioning (stripe_customer_id);

create index if not exists customer_provisioning_stripe_subscription_id_idx
  on jpvbootcamp.customer_provisioning (stripe_subscription_id);
