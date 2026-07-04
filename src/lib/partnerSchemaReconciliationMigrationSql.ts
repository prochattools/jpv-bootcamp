import { quotePgIdentifier } from './payloadMigrationSchema'

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

function getSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (databaseUrl == null || databaseUrl === '') {
    const appSlug = process.env.APP_SLUG
    if (appSlug == null || appSlug === '') {
      throw new Error('DATABASE_URL or APP_SLUG is required for Payload partner schema reconciliation')
    }
    if (!schemaIdentifierPattern.test(appSlug)) {
      throw new Error(`Invalid Payload migration schema: ${appSlug}`)
    }
    return appSlug
  }
  let schema: string | null
  try {
    schema = new URL(databaseUrl).searchParams.get('schema')
  } catch {
    throw new Error('Malformed DATABASE_URL')
  }
  const resolved = schema || process.env.APP_SLUG
  if (resolved == null || resolved === '') {
    throw new Error('DATABASE_URL schema or APP_SLUG is required for Payload partner schema reconciliation')
  }
  if (!schemaIdentifierPattern.test(resolved)) {
    throw new Error(`Invalid Payload migration schema: ${resolved}`)
  }
  return resolved
}

function getSchemaSqlPrefix(databaseUrl = process.env.DATABASE_URL): string {
  return quotePgIdentifier(getSchema(databaseUrl))
}

export function buildPartnerSchemaReconciliationMigrationUpSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schema = getSchemaSqlPrefix(databaseUrl)
  const schemaName = getSchema(databaseUrl)

  return `
  CREATE TABLE IF NOT EXISTS ${schema}."payload_partner_affiliates_recipient_emails" (
    "id" serial PRIMARY KEY NOT NULL,
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "email" varchar NOT NULL
  );

  CREATE INDEX IF NOT EXISTS "payload_partner_affiliates_recipient_emails_order_idx"
    ON ${schema}."payload_partner_affiliates_recipient_emails" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "payload_partner_affiliates_recipient_emails_parent_id_idx"
    ON ${schema}."payload_partner_affiliates_recipient_emails" USING btree ("_parent_id");

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = '${getSchema(databaseUrl)}'
        AND t.relname = 'payload_partner_affiliates_recipient_emails'
        AND c.conname = 'payload_partner_affiliates_recipient_emails_parent_id_fk'
    ) THEN
      ALTER TABLE ${schema}."payload_partner_affiliates_recipient_emails"
        ADD CONSTRAINT "payload_partner_affiliates_recipient_emails_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES ${schema}."payload_partner_affiliates"("id")
        ON DELETE cascade ON UPDATE no action;
    END IF;
  END
  $$;

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = '${schemaName}'
        AND table_name = 'payload_partner_affiliates'
        AND column_name = 'recipient_emails'
    ) THEN
      EXECUTE $reconcile_recipient_emails$
        INSERT INTO ${schema}."payload_partner_affiliates_recipient_emails" ("_order", "_parent_id", "email")
        SELECT (recipient.ordinality - 1)::integer, partner."id", recipient.value->>'email'
        FROM ${schema}."payload_partner_affiliates" partner
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(partner."recipient_emails") = 'array' THEN partner."recipient_emails"
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS recipient(value, ordinality)
        WHERE partner."recipient_emails" IS NOT NULL
          AND recipient.value ? 'email'
          AND NOT EXISTS (
            SELECT 1
            FROM ${schema}."payload_partner_affiliates_recipient_emails" existing
            WHERE existing."_parent_id" = partner."id"
              AND existing."email" = recipient.value->>'email'
          )
      $reconcile_recipient_emails$;
    END IF;
  END
  $$;

  ALTER TABLE ${schema}."payload_partner_applications"
    ADD COLUMN IF NOT EXISTS "partner_slug_snapshot" varchar,
    ADD COLUMN IF NOT EXISTS "partner_name_snapshot" varchar,
    ADD COLUMN IF NOT EXISTS "company_snapshot" varchar,
    ADD COLUMN IF NOT EXISTS "country_snapshot" varchar,
    ADD COLUMN IF NOT EXISTS "experience_snapshot" varchar,
    ADD COLUMN IF NOT EXISTS "message_snapshot" text,
    ADD COLUMN IF NOT EXISTS "trusted_destination_snapshot" varchar;

  CREATE INDEX IF NOT EXISTS "payload_partner_applications_partner_slug_snapshot_idx"
    ON ${schema}."payload_partner_applications" USING btree ("partner_slug_snapshot");
  `
}

export function buildPartnerSchemaReconciliationMigrationDownSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schema = getSchemaSqlPrefix(databaseUrl)

  return `
  DROP INDEX IF EXISTS ${schema}."payload_partner_applications_partner_slug_snapshot_idx";
  ALTER TABLE ${schema}."payload_partner_applications"
    DROP COLUMN IF EXISTS "trusted_destination_snapshot",
    DROP COLUMN IF EXISTS "message_snapshot",
    DROP COLUMN IF EXISTS "experience_snapshot",
    DROP COLUMN IF EXISTS "country_snapshot",
    DROP COLUMN IF EXISTS "company_snapshot",
    DROP COLUMN IF EXISTS "partner_name_snapshot",
    DROP COLUMN IF EXISTS "partner_slug_snapshot";
  DROP TABLE IF EXISTS ${schema}."payload_partner_affiliates_recipient_emails" CASCADE;
  `
}
