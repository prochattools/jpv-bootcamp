-- Deduplicate customer_provisioning rows by normalized email (tenant_jpvbootcamp).
-- Idempotent: safe to run multiple times.

ALTER TABLE tenant_jpvbootcamp.customer_provisioning
	ADD COLUMN IF NOT EXISTS normalized_email text;

UPDATE tenant_jpvbootcamp.customer_provisioning
SET normalized_email = lower(trim(email))
WHERE normalized_email IS NULL OR normalized_email = '';

WITH ranked AS (
	SELECT
		*,
		row_number() OVER (
			PARTITION BY normalized_email
			ORDER BY
				(wp_user_id IS NOT NULL) DESC,
				(stripe_customer_id IS NOT NULL) DESC,
				COALESCE(updated_at, created_at) DESC,
				created_at DESC
		) AS rn
	FROM tenant_jpvbootcamp.customer_provisioning
),
canonical AS (
	SELECT * FROM ranked WHERE rn = 1
),
merged AS (
	SELECT
		normalized_email,
		(array_agg(wp_user_id ORDER BY (wp_user_id IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_wp_user_id,
		(array_agg(stripe_customer_id ORDER BY (stripe_customer_id IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_stripe_customer_id,
		(array_agg(stripe_subscription_id ORDER BY (stripe_subscription_id IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_stripe_subscription_id,
		(array_agg(plan ORDER BY (plan IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_plan,
		(array_agg(current_plan ORDER BY (current_plan IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_current_plan,
		(array_agg(status ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_status,
		(array_agg(last_event_id ORDER BY (last_event_id IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_last_event_id,
		(array_agg(last_notified_plan ORDER BY (last_notified_plan IS NOT NULL) DESC, last_notified_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_last_notified_plan,
		(array_agg(last_notified_at ORDER BY (last_notified_at IS NOT NULL) DESC, last_notified_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_last_notified_at,
		(array_agg(last_notified_event_id ORDER BY (last_notified_event_id IS NOT NULL) DESC, last_notified_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST))[1] AS best_last_notified_event_id,
		max(updated_at) AS max_updated_at
	FROM ranked
	GROUP BY normalized_email
)
UPDATE tenant_jpvbootcamp.customer_provisioning cp
SET
	wp_user_id = COALESCE(cp.wp_user_id, m.best_wp_user_id),
	stripe_customer_id = COALESCE(cp.stripe_customer_id, m.best_stripe_customer_id),
	stripe_subscription_id = COALESCE(cp.stripe_subscription_id, m.best_stripe_subscription_id),
	plan = COALESCE(cp.plan, m.best_plan),
	current_plan = COALESCE(cp.current_plan, m.best_current_plan),
	status = COALESCE(cp.status, m.best_status),
	last_event_id = COALESCE(cp.last_event_id, m.best_last_event_id),
	last_notified_plan = COALESCE(cp.last_notified_plan, m.best_last_notified_plan),
	last_notified_at = COALESCE(cp.last_notified_at, m.best_last_notified_at),
	last_notified_event_id = COALESCE(cp.last_notified_event_id, m.best_last_notified_event_id),
	updated_at = GREATEST(cp.updated_at, m.max_updated_at)
FROM canonical c
JOIN merged m ON m.normalized_email = c.normalized_email
WHERE cp.id = c.id;

DELETE FROM tenant_jpvbootcamp.customer_provisioning cp
USING canonical c
WHERE cp.normalized_email = c.normalized_email
  AND cp.id <> c.id;

ALTER TABLE tenant_jpvbootcamp.customer_provisioning
	ALTER COLUMN normalized_email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_provisioning_normalized_email_key
	ON tenant_jpvbootcamp.customer_provisioning (normalized_email);
