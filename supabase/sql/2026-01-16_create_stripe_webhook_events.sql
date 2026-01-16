-- Stripe webhook idempotency table for tenant_jpvbootcamp
create schema if not exists tenant_jpvbootcamp;

create table if not exists tenant_jpvbootcamp.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null default 'unknown',
  livemode boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb
);

create index if not exists stripe_webhook_events_received_at_idx
  on tenant_jpvbootcamp.stripe_webhook_events (received_at);
