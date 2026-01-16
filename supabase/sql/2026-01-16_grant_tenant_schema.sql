-- Grant schema and table permissions for Stripe webhook idempotency.
-- Replace <ROLE_NAME> with the tenant role (e.g., tenant_jpvbootcamp_user or service_role).

grant usage on schema tenant_jpvbootcamp to <ROLE_NAME>;

grant select, insert, update, delete
on table tenant_jpvbootcamp.stripe_webhook_events
to <ROLE_NAME>;
