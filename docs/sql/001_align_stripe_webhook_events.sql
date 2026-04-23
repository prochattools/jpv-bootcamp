-- Align jpvbootcamp.stripe_webhook_events to expected columns.
-- Adds missing columns only; no drops.

create schema if not exists jpvbootcamp;

create table if not exists jpvbootcamp.stripe_webhook_events (
  event_id text primary key,
  type text,
  livemode boolean,
  received_at timestamptz default now(),
  processed_at timestamptz,
  payload jsonb
);

alter table jpvbootcamp.stripe_webhook_events
  add column if not exists event_id text,
  add column if not exists type text,
  add column if not exists livemode boolean,
  add column if not exists received_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists payload jsonb;

create unique index if not exists stripe_webhook_events_event_id_idx
  on jpvbootcamp.stripe_webhook_events (event_id);
