import { quotePgIdentifier } from './payloadMigrationSchema'

const defaultPayloadSchema = 'jpvbootcamp'
const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

function getSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (databaseUrl == null || databaseUrl === '') return defaultPayloadSchema
  let schema: string | null
  try {
    schema = new URL(databaseUrl).searchParams.get('schema')
  } catch {
    throw new Error(`Malformed DATABASE_URL: ${databaseUrl}`)
  }
  const resolved = schema || defaultPayloadSchema
  if (!schemaIdentifierPattern.test(resolved)) {
    throw new Error(`Invalid Payload migration schema: ${resolved}`)
  }
  return resolved
}

function getSchemaSqlPrefix(databaseUrl = process.env.DATABASE_URL): string {
  return quotePgIdentifier(getSchema(databaseUrl))
}

export function buildPartnerAffiliateOperationsMigrationUpSql(databaseUrl = process.env.DATABASE_URL): string {
  const schema = getSchemaSqlPrefix(databaseUrl)
  return `
  CREATE TYPE ${schema}."enum_payload_partner_affiliates_status" AS ENUM('draft', 'active', 'paused', 'archived');
  CREATE TYPE ${schema}."enum_payload_partner_affiliates_application_mode" AS ENUM('redirect', 'email', 'webhook', 'manual_export');
  CREATE TYPE ${schema}."enum_payload_partner_applications_status" AS ENUM('submitted', 'delivery_pending', 'delivered', 'delivery_failed');
  CREATE TYPE ${schema}."enum_payload_partner_applications_delivery_method" AS ENUM('redirect', 'email', 'webhook', 'manual_export');
  CREATE TABLE ${schema}."payload_partner_affiliates" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "status" ${schema}."enum_payload_partner_affiliates_status" DEFAULT 'draft' NOT NULL,
    "category" varchar NOT NULL,
    "summary" text,
    "logo" varchar,
    "application_mode" ${schema}."enum_payload_partner_affiliates_application_mode" DEFAULT 'redirect' NOT NULL,
    "affiliate_url" varchar,
    "recipient_emails" jsonb,
    "webhook_endpoint" varchar,
    "required_fields" jsonb,
    "privacy_notice" text,
    "sort_order" numeric DEFAULT 0 NOT NULL,
    "external_reference" varchar,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE ${schema}."payload_partner_applications" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "member_id" integer NOT NULL,
    "partner_id" integer NOT NULL,
    "status" ${schema}."enum_payload_partner_applications_status" DEFAULT 'submitted' NOT NULL,
    "submitted_at" timestamp(3) with time zone,
    "delivered_at" timestamp(3) with time zone,
    "application_reference" varchar,
    "member_name_snapshot" varchar,
    "member_email_snapshot" varchar,
    "member_phone_snapshot" varchar,
    "company_snapshot" varchar,
    "country_snapshot" varchar,
    "experience_snapshot" varchar,
    "message_snapshot" text,
    "consent_accepted_at" timestamp(3) with time zone,
    "delivery_method" ${schema}."enum_payload_partner_applications_delivery_method" NOT NULL,
    "delivery_attempts" numeric DEFAULT 0 NOT NULL,
    "last_delivery_error" text,
    "trusted_destination_snapshot" varchar,
    "source" varchar DEFAULT 'portal' NOT NULL,
    "source_member_id" numeric,
    "legacy_reference" varchar,
    "internal_notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE ${schema}."payload_partner_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "partner_id" integer,
    "application_id" integer,
    "member_id" integer,
    "event_type" varchar NOT NULL,
    "source_route" varchar,
    "status" varchar,
    "delivery_method" ${schema}."enum_payload_partner_applications_delivery_method",
    "attempt" numeric,
    "delivery_error" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE UNIQUE INDEX "payload_partner_affiliates_slug_idx" ON ${schema}."payload_partner_affiliates" USING btree ("slug");
  CREATE INDEX "payload_partner_affiliates_status_idx" ON ${schema}."payload_partner_affiliates" USING btree ("status");
  CREATE INDEX "payload_partner_affiliates_application_mode_idx" ON ${schema}."payload_partner_affiliates" USING btree ("application_mode");
  CREATE UNIQUE INDEX "payload_partner_applications_reference_idx" ON ${schema}."payload_partner_applications" USING btree ("application_reference");
  CREATE INDEX "payload_partner_applications_member_idx" ON ${schema}."payload_partner_applications" USING btree ("member_id");
  CREATE INDEX "payload_partner_applications_partner_idx" ON ${schema}."payload_partner_applications" USING btree ("partner_id");
  CREATE INDEX "payload_partner_applications_status_idx" ON ${schema}."payload_partner_applications" USING btree ("status");
  CREATE INDEX "payload_partner_events_partner_idx" ON ${schema}."payload_partner_events" USING btree ("partner_id");
  CREATE INDEX "payload_partner_events_application_idx" ON ${schema}."payload_partner_events" USING btree ("application_id");
  CREATE INDEX "payload_partner_events_event_type_idx" ON ${schema}."payload_partner_events" USING btree ("event_type");
  ALTER TABLE ${schema}."payload_partner_affiliates" ADD CONSTRAINT "payload_partner_affiliates_slug_unique" UNIQUE ("slug");
  ALTER TABLE ${schema}."payload_partner_applications" ADD CONSTRAINT "payload_partner_applications_member_partner_unique" UNIQUE ("member_id", "partner_id");
  ALTER TABLE ${schema}."payload_partner_applications" ADD CONSTRAINT "payload_partner_applications_member_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE ${schema}."payload_partner_applications" ADD CONSTRAINT "payload_partner_applications_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES ${schema}."payload_partner_affiliates"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE ${schema}."payload_partner_events" ADD CONSTRAINT "payload_partner_events_partner_id_fk" FOREIGN KEY ("partner_id") REFERENCES ${schema}."payload_partner_affiliates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_partner_events" ADD CONSTRAINT "payload_partner_events_application_id_fk" FOREIGN KEY ("application_id") REFERENCES ${schema}."payload_partner_applications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_partner_events" ADD CONSTRAINT "payload_partner_events_member_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;`
}

export function buildPartnerAffiliateOperationsMigrationDownSql(databaseUrl = process.env.DATABASE_URL): string {
  const schema = getSchemaSqlPrefix(databaseUrl)
  return `
  ALTER TABLE ${schema}."payload_partner_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_partner_applications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ${schema}."payload_partner_affiliates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE ${schema}."payload_partner_events" CASCADE;
  DROP TABLE ${schema}."payload_partner_applications" CASCADE;
  DROP TABLE ${schema}."payload_partner_affiliates" CASCADE;
  DROP TYPE ${schema}."enum_payload_partner_applications_delivery_method";
  DROP TYPE ${schema}."enum_payload_partner_applications_status";
  DROP TYPE ${schema}."enum_payload_partner_affiliates_application_mode";
  DROP TYPE ${schema}."enum_payload_partner_affiliates_status";`
}
