import { quotePgIdentifier } from '../payloadMigrationSchema'

const defaultPayloadSchema = 'jpvbootcamp'
const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

export function getMembershipSupportMigrationSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (databaseUrl == null || databaseUrl === '') {
    return defaultPayloadSchema
  }

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

function getMembershipSupportMigrationSchemaSqlPrefix(databaseUrl = process.env.DATABASE_URL): string {
  return quotePgIdentifier(getMembershipSupportMigrationSchema(databaseUrl))
}

export function buildMembershipSupportMigrationUpSql(databaseUrl = process.env.DATABASE_URL): string {
  const schema = getMembershipSupportMigrationSchemaSqlPrefix(databaseUrl)

  return `
  -- Membership Support Schema Migration: Core Enumerations
  CREATE TYPE ${schema}."enum_payload_membership_support_records_funding_source" AS ENUM ('direct_payment', 'voucher', 'pay_it_forward');
  CREATE TYPE ${schema}."enum_payload_membership_support_records_voucher_duration" AS ENUM ('one_month', 'one_year');
  CREATE TYPE ${schema}."enum_payload_membership_support_records_issuance_state" AS ENUM ('draft', 'issued', 'redeemed', 'expired', 'deactivated');
  CREATE TYPE ${schema}."enum_payload_membership_support_records_billing_cadence" AS ENUM ('monthly', 'annual');
  CREATE TYPE ${schema}."enum_payload_membership_support_records_reconciliation_state" AS ENUM ('pending', 'matched', 'mismatch', 'failed');

  CREATE TYPE ${schema}."enum_payload_membership_vouchers_approval_state" AS ENUM ('draft', 'submitted', 'approved', 'issued', 'rejected');
  CREATE TYPE ${schema}."enum_payload_membership_vouchers_redemption_state" AS ENUM ('not_redeemed', 'redeemed', 'expired', 'deactivated');
  CREATE TYPE ${schema}."enum_payload_membership_vouchers_voucher_duration" AS ENUM ('one_month', 'one_year');
  CREATE TYPE ${schema}."enum_payload_membership_vouchers_billing_cadence" AS ENUM ('monthly', 'annual');

  CREATE TYPE ${schema}."enum_payload_pay_it_forward_funding_approval_state" AS ENUM ('draft', 'submitted', 'approved', 'issued', 'rejected');
  CREATE TYPE ${schema}."enum_payload_pay_it_forward_funding_billing_cadence" AS ENUM ('monthly', 'annual');

  CREATE TYPE ${schema}."enum_payload_membership_funding_sources_source_type" AS ENUM ('direct_payment', 'voucher', 'pay_it_forward');
  CREATE TYPE ${schema}."enum_payload_membership_funding_sources_source_state" AS ENUM ('planned', 'approved', 'allocated', 'depleted', 'revoked');

  CREATE TYPE ${schema}."enum_payload_membership_reconciliations_reconciliation_state" AS ENUM ('pending', 'matched', 'mismatch', 'failed');

  CREATE TYPE ${schema}."enum_payload_membership_review_queue_items_queue_state" AS ENUM ('needs_review', 'in_progress', 'resolved', 'escalated', 'on_hold');
  CREATE TYPE ${schema}."enum_payload_membership_review_queue_items_queue_reason" AS ENUM ('approval_required', 'mismatch_detected', 'payment_issue', 'manual_follow_up', 'reconciliation_error', 'upgrade_available');

  CREATE TYPE ${schema}."enum_payload_membership_audit_history_actor_type" AS ENUM ('admin', 'member', 'stripe', 'system', 'migration');
  CREATE TYPE ${schema}."enum_payload_membership_audit_history_severity" AS ENUM ('debug', 'info', 'warning', 'error', 'critical');

  CREATE TYPE ${schema}."enum_payload_operator_notes_target_type" AS ENUM ('membership_support', 'voucher', 'pay_it_forward', 'funding_source', 'reconciliation', 'review_queue');
  CREATE TYPE ${schema}."enum_payload_operator_notes_visibility" AS ENUM ('internal', 'member_visible', 'archived');

  CREATE TYPE ${schema}."enum_payload_stripe_shadow_projections_shadow_state" AS ENUM ('pending', 'shadowed', 'reconciled', 'divergent', 'error');

  -- Membership Support Records (Core Support Entity)
  CREATE TABLE ${schema}."payload_membership_support_records" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "member_id" integer NOT NULL,
    "member_email" varchar NOT NULL,
    "funding_source" ${schema}."enum_payload_membership_support_records_funding_source" DEFAULT 'direct_payment' NOT NULL,
    "voucher_duration" ${schema}."enum_payload_membership_support_records_voucher_duration",
    "issuance_state" ${schema}."enum_payload_membership_support_records_issuance_state" DEFAULT 'draft' NOT NULL,
    "billing_cadence" ${schema}."enum_payload_membership_support_records_billing_cadence" DEFAULT 'monthly' NOT NULL,
    "stripe_customer_id" varchar,
    "stripe_subscription_id" varchar,
    "stripe_price_id" varchar,
    "stripe_coupon_id" varchar,
    "stripe_promotion_code_id" varchar,
    "approval_reference" varchar,
    "issued_by" integer,
    "approved_by" integer,
    "issued_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone,
    "redeemed_at" timestamp(3) with time zone,
    "deactivated_at" timestamp(3) with time zone,
    "reconciliation_state" ${schema}."enum_payload_membership_support_records_reconciliation_state" DEFAULT 'pending' NOT NULL,
    "last_webhook_at" timestamp(3) with time zone,
    "notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Membership Vouchers
  CREATE TABLE ${schema}."payload_membership_vouchers" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "support_id" integer NOT NULL,
    "member_id" integer NOT NULL,
    "member_email" varchar NOT NULL,
    "voucher_duration" ${schema}."enum_payload_membership_vouchers_voucher_duration" NOT NULL,
    "approval_state" ${schema}."enum_payload_membership_vouchers_approval_state" DEFAULT 'draft' NOT NULL,
    "redemption_state" ${schema}."enum_payload_membership_vouchers_redemption_state" DEFAULT 'not_redeemed' NOT NULL,
    "billing_cadence" ${schema}."enum_payload_membership_vouchers_billing_cadence" DEFAULT 'monthly' NOT NULL,
    "stripe_customer_id" varchar,
    "stripe_coupon_id" varchar,
    "stripe_promotion_code_id" varchar,
    "approval_reference" varchar,
    "issued_by" integer,
    "approved_by" integer,
    "issued_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone,
    "redeemed_at" timestamp(3) with time zone,
    "deactivated_at" timestamp(3) with time zone,
    "reason" text NOT NULL,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Pay It Forward Funding
  CREATE TABLE ${schema}."payload_pay_it_forward_funding" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "support_id" integer NOT NULL,
    "member_id" integer NOT NULL,
    "member_email" varchar NOT NULL,
    "donor_name" varchar NOT NULL,
    "approval_state" ${schema}."enum_payload_pay_it_forward_funding_approval_state" DEFAULT 'draft' NOT NULL,
    "billing_cadence" ${schema}."enum_payload_pay_it_forward_funding_billing_cadence" DEFAULT 'monthly' NOT NULL,
    "allocated_amount_minor" numeric NOT NULL,
    "currency" varchar DEFAULT 'GBP' NOT NULL,
    "stripe_customer_id" varchar,
    "stripe_coupon_id" varchar,
    "stripe_promotion_code_id" varchar,
    "stripe_subscription_id" varchar,
    "approval_reference" varchar NOT NULL,
    "issued_by" integer,
    "approved_by" integer,
    "issued_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone,
    "redeemed_at" timestamp(3) with time zone,
    "revoked_at" timestamp(3) with time zone,
    "reason" text NOT NULL,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "payload_pay_it_forward_funding_allocated_amount_minor_check" CHECK ("allocated_amount_minor" >= 0 AND "allocated_amount_minor" = trunc("allocated_amount_minor"))
  );

  -- Membership Funding Sources (Canonical funding record)
  CREATE TABLE ${schema}."payload_membership_funding_sources" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "support_id" integer,
    "voucher_id" integer,
    "member_id" integer,
    "source_type" ${schema}."enum_payload_membership_funding_sources_source_type" DEFAULT 'direct_payment' NOT NULL,
    "source_state" ${schema}."enum_payload_membership_funding_sources_source_state" DEFAULT 'planned' NOT NULL,
    "committed_amount_minor" numeric NOT NULL,
    "available_amount_minor" numeric NOT NULL,
    "currency" varchar DEFAULT 'GBP' NOT NULL,
    "donor_name" varchar,
    "approval_reference" varchar,
    "issued_by" integer,
    "approved_by" integer,
    "issued_at" timestamp(3) with time zone,
    "depleted_at" timestamp(3) with time zone,
    "notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "payload_membership_funding_sources_committed_amount_check" CHECK ("committed_amount_minor" >= 0 AND "committed_amount_minor" = trunc("committed_amount_minor")),
    CONSTRAINT "payload_membership_funding_sources_available_amount_check" CHECK ("available_amount_minor" >= 0 AND "available_amount_minor" = trunc("available_amount_minor"))
  );

  -- Membership Reconciliations (Stripe reconciliation state)
  CREATE TABLE ${schema}."payload_membership_reconciliations" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "support_id" integer,
    "voucher_id" integer,
    "funding_source_id" integer,
    "member_id" integer,
    "stripe_event_id" varchar,
    "stripe_event_type" varchar NOT NULL,
    "reconciliation_state" ${schema}."enum_payload_membership_reconciliations_reconciliation_state" DEFAULT 'pending' NOT NULL,
    "failure_code" varchar,
    "last_webhook_at" timestamp(3) with time zone,
    "resolved_at" timestamp(3) with time zone,
    "notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Membership Review Queue (Approval, error handling)
  CREATE TABLE ${schema}."payload_membership_review_queue_items" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "support_id" integer,
    "voucher_id" integer,
    "funding_source_id" integer,
    "reconciliation_id" integer,
    "member_id" integer,
    "queue_state" ${schema}."enum_payload_membership_review_queue_items_queue_state" DEFAULT 'needs_review' NOT NULL,
    "queue_reason" ${schema}."enum_payload_membership_review_queue_items_queue_reason" DEFAULT 'approval_required' NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "assigned_to" integer,
    "due_at" timestamp(3) with time zone,
    "resolved_at" timestamp(3) with time zone,
    "notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "payload_membership_review_queue_items_priority_check" CHECK ("priority" >= 0)
  );

  -- Operator Notes (Internal annotations)
  CREATE TABLE ${schema}."payload_operator_notes" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "target_type" ${schema}."enum_payload_operator_notes_target_type" NOT NULL,
    "target_id" varchar NOT NULL,
    "visibility" ${schema}."enum_payload_operator_notes_visibility" DEFAULT 'internal' NOT NULL,
    "author" integer NOT NULL,
    "support_id" integer,
    "voucher_id" integer,
    "funding_source_id" integer,
    "reconciliation_id" integer,
    "audit_history_id" integer,
    "note" text NOT NULL,
    "pinned" boolean DEFAULT false,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Membership Audit History (Append-only compliance log)
  CREATE TABLE ${schema}."payload_membership_audit_history" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "actor_type" ${schema}."enum_payload_membership_audit_history_actor_type" NOT NULL,
    "actor_id" varchar,
    "action" varchar NOT NULL,
    "target_collection" varchar NOT NULL,
    "target_id" varchar,
    "severity" ${schema}."enum_payload_membership_audit_history_severity" DEFAULT 'info' NOT NULL,
    "approval_reference" varchar,
    "support_id" integer,
    "voucher_id" integer,
    "funding_source_id" integer,
    "reconciliation_id" integer,
    "before" jsonb,
    "after" jsonb,
    "notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Stripe Shadow Projections (Repository-only shadow of Stripe state)
  CREATE TABLE ${schema}."payload_stripe_shadow_projections" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar NOT NULL,
    "support_id" integer,
    "voucher_id" integer,
    "funding_source_id" integer,
    "member_id" integer,
    "stripe_customer_id" varchar,
    "stripe_subscription_id" varchar,
    "stripe_price_id" varchar,
    "stripe_coupon_id" varchar,
    "stripe_promotion_code_id" varchar,
    "stripe_invoice_id" varchar,
    "stripe_event_id" varchar,
    "shadow_state" ${schema}."enum_payload_stripe_shadow_projections_shadow_state" DEFAULT 'pending' NOT NULL,
    "last_webhook_at" timestamp(3) with time zone,
    "shadowed_at" timestamp(3) with time zone,
    "observed_status" varchar,
    "notes" text,
    "metadata" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Foreign Key Constraints: Membership Support Records
  ALTER TABLE ${schema}."payload_membership_support_records"
    ADD CONSTRAINT "payload_membership_support_records_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE restrict ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_support_records"
    ADD CONSTRAINT "payload_membership_support_records_issued_by_fk"
    FOREIGN KEY ("issued_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_support_records"
    ADD CONSTRAINT "payload_membership_support_records_approved_by_fk"
    FOREIGN KEY ("approved_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Membership Vouchers
  ALTER TABLE ${schema}."payload_membership_vouchers"
    ADD CONSTRAINT "payload_membership_vouchers_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE restrict ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_vouchers"
    ADD CONSTRAINT "payload_membership_vouchers_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE restrict ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_vouchers"
    ADD CONSTRAINT "payload_membership_vouchers_issued_by_fk"
    FOREIGN KEY ("issued_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_vouchers"
    ADD CONSTRAINT "payload_membership_vouchers_approved_by_fk"
    FOREIGN KEY ("approved_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Pay It Forward Funding
  ALTER TABLE ${schema}."payload_pay_it_forward_funding"
    ADD CONSTRAINT "payload_pay_it_forward_funding_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE restrict ON UPDATE no action;

  ALTER TABLE ${schema}."payload_pay_it_forward_funding"
    ADD CONSTRAINT "payload_pay_it_forward_funding_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE restrict ON UPDATE no action;

  ALTER TABLE ${schema}."payload_pay_it_forward_funding"
    ADD CONSTRAINT "payload_pay_it_forward_funding_issued_by_fk"
    FOREIGN KEY ("issued_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_pay_it_forward_funding"
    ADD CONSTRAINT "payload_pay_it_forward_funding_approved_by_fk"
    FOREIGN KEY ("approved_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Membership Funding Sources
  ALTER TABLE ${schema}."payload_membership_funding_sources"
    ADD CONSTRAINT "payload_membership_funding_sources_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_funding_sources"
    ADD CONSTRAINT "payload_membership_funding_sources_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_funding_sources"
    ADD CONSTRAINT "payload_membership_funding_sources_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_funding_sources"
    ADD CONSTRAINT "payload_membership_funding_sources_issued_by_fk"
    FOREIGN KEY ("issued_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_funding_sources"
    ADD CONSTRAINT "payload_membership_funding_sources_approved_by_fk"
    FOREIGN KEY ("approved_by") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Membership Reconciliations
  ALTER TABLE ${schema}."payload_membership_reconciliations"
    ADD CONSTRAINT "payload_membership_reconciliations_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_reconciliations"
    ADD CONSTRAINT "payload_membership_reconciliations_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_reconciliations"
    ADD CONSTRAINT "payload_membership_reconciliations_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES ${schema}."payload_membership_funding_sources"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_reconciliations"
    ADD CONSTRAINT "payload_membership_reconciliations_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Membership Review Queue Items
  ALTER TABLE ${schema}."payload_membership_review_queue_items"
    ADD CONSTRAINT "payload_membership_review_queue_items_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_review_queue_items"
    ADD CONSTRAINT "payload_membership_review_queue_items_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_review_queue_items"
    ADD CONSTRAINT "payload_membership_review_queue_items_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES ${schema}."payload_membership_funding_sources"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_review_queue_items"
    ADD CONSTRAINT "payload_membership_review_queue_items_reconciliation_id_fk"
    FOREIGN KEY ("reconciliation_id") REFERENCES ${schema}."payload_membership_reconciliations"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_review_queue_items"
    ADD CONSTRAINT "payload_membership_review_queue_items_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_review_queue_items"
    ADD CONSTRAINT "payload_membership_review_queue_items_assigned_to_fk"
    FOREIGN KEY ("assigned_to") REFERENCES ${schema}."payload_users"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Operator Notes
  ALTER TABLE ${schema}."payload_operator_notes"
    ADD CONSTRAINT "payload_operator_notes_author_fk"
    FOREIGN KEY ("author") REFERENCES ${schema}."payload_users"("id") ON DELETE restrict ON UPDATE no action;

  ALTER TABLE ${schema}."payload_operator_notes"
    ADD CONSTRAINT "payload_operator_notes_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_operator_notes"
    ADD CONSTRAINT "payload_operator_notes_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_operator_notes"
    ADD CONSTRAINT "payload_operator_notes_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES ${schema}."payload_membership_funding_sources"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_operator_notes"
    ADD CONSTRAINT "payload_operator_notes_reconciliation_id_fk"
    FOREIGN KEY ("reconciliation_id") REFERENCES ${schema}."payload_membership_reconciliations"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_operator_notes"
    ADD CONSTRAINT "payload_operator_notes_audit_history_id_fk"
    FOREIGN KEY ("audit_history_id") REFERENCES ${schema}."payload_membership_audit_history"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Membership Audit History
  ALTER TABLE ${schema}."payload_membership_audit_history"
    ADD CONSTRAINT "payload_membership_audit_history_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_audit_history"
    ADD CONSTRAINT "payload_membership_audit_history_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_audit_history"
    ADD CONSTRAINT "payload_membership_audit_history_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES ${schema}."payload_membership_funding_sources"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_membership_audit_history"
    ADD CONSTRAINT "payload_membership_audit_history_reconciliation_id_fk"
    FOREIGN KEY ("reconciliation_id") REFERENCES ${schema}."payload_membership_reconciliations"("id") ON DELETE set null ON UPDATE no action;

  -- Foreign Key Constraints: Stripe Shadow Projections
  ALTER TABLE ${schema}."payload_stripe_shadow_projections"
    ADD CONSTRAINT "payload_stripe_shadow_projections_support_id_fk"
    FOREIGN KEY ("support_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_stripe_shadow_projections"
    ADD CONSTRAINT "payload_stripe_shadow_projections_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_stripe_shadow_projections"
    ADD CONSTRAINT "payload_stripe_shadow_projections_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES ${schema}."payload_membership_funding_sources"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE ${schema}."payload_stripe_shadow_projections"
    ADD CONSTRAINT "payload_stripe_shadow_projections_member_id_fk"
    FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;

  -- Indexes: Membership Support Records
  CREATE INDEX "payload_membership_support_records_member_email_idx" ON ${schema}."payload_membership_support_records" USING btree ("member_email");
  CREATE INDEX "payload_membership_support_records_member_id_idx" ON ${schema}."payload_membership_support_records" USING btree ("member_id");
  CREATE INDEX "payload_membership_support_records_stripe_customer_id_idx" ON ${schema}."payload_membership_support_records" USING btree ("stripe_customer_id");
  CREATE INDEX "payload_membership_support_records_stripe_subscription_id_idx" ON ${schema}."payload_membership_support_records" USING btree ("stripe_subscription_id");
  CREATE INDEX "payload_membership_support_records_approval_reference_idx" ON ${schema}."payload_membership_support_records" USING btree ("approval_reference");
  CREATE INDEX "payload_membership_support_records_issuance_state_idx" ON ${schema}."payload_membership_support_records" USING btree ("issuance_state");
  CREATE INDEX "payload_membership_support_records_reconciliation_state_idx" ON ${schema}."payload_membership_support_records" USING btree ("reconciliation_state");
  CREATE INDEX "payload_membership_support_records_updated_at_idx" ON ${schema}."payload_membership_support_records" USING btree ("updated_at");
  CREATE INDEX "payload_membership_support_records_created_at_idx" ON ${schema}."payload_membership_support_records" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_membership_support_records_member_approval_key" ON ${schema}."payload_membership_support_records" ("member_id", "approval_reference") WHERE "approval_reference" IS NOT NULL;

  -- Indexes: Membership Vouchers
  CREATE INDEX "payload_membership_vouchers_support_id_idx" ON ${schema}."payload_membership_vouchers" USING btree ("support_id");
  CREATE INDEX "payload_membership_vouchers_member_id_idx" ON ${schema}."payload_membership_vouchers" USING btree ("member_id");
  CREATE INDEX "payload_membership_vouchers_member_email_idx" ON ${schema}."payload_membership_vouchers" USING btree ("member_email");
  CREATE INDEX "payload_membership_vouchers_approval_state_idx" ON ${schema}."payload_membership_vouchers" USING btree ("approval_state");
  CREATE INDEX "payload_membership_vouchers_redemption_state_idx" ON ${schema}."payload_membership_vouchers" USING btree ("redemption_state");
  CREATE INDEX "payload_membership_vouchers_stripe_customer_id_idx" ON ${schema}."payload_membership_vouchers" USING btree ("stripe_customer_id");
  CREATE INDEX "payload_membership_vouchers_updated_at_idx" ON ${schema}."payload_membership_vouchers" USING btree ("updated_at");
  CREATE INDEX "payload_membership_vouchers_created_at_idx" ON ${schema}."payload_membership_vouchers" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_membership_vouchers_support_approval_key" ON ${schema}."payload_membership_vouchers" ("support_id", "approval_reference") WHERE "approval_reference" IS NOT NULL;

  -- Indexes: Pay It Forward Funding
  CREATE INDEX "payload_pay_it_forward_funding_support_id_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("support_id");
  CREATE INDEX "payload_pay_it_forward_funding_member_id_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("member_id");
  CREATE INDEX "payload_pay_it_forward_funding_member_email_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("member_email");
  CREATE INDEX "payload_pay_it_forward_funding_approval_state_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("approval_state");
  CREATE INDEX "payload_pay_it_forward_funding_stripe_subscription_id_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("stripe_subscription_id");
  CREATE INDEX "payload_pay_it_forward_funding_updated_at_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("updated_at");
  CREATE INDEX "payload_pay_it_forward_funding_created_at_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_pay_it_forward_funding_approval_key" ON ${schema}."payload_pay_it_forward_funding" ("approval_reference");

  -- Indexes: Membership Funding Sources
  CREATE INDEX "payload_membership_funding_sources_support_id_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("support_id");
  CREATE INDEX "payload_membership_funding_sources_voucher_id_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("voucher_id");
  CREATE INDEX "payload_membership_funding_sources_member_id_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("member_id");
  CREATE INDEX "payload_membership_funding_sources_source_type_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("source_type");
  CREATE INDEX "payload_membership_funding_sources_source_state_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("source_state");
  CREATE INDEX "payload_membership_funding_sources_approval_reference_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("approval_reference");
  CREATE INDEX "payload_membership_funding_sources_updated_at_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("updated_at");
  CREATE INDEX "payload_membership_funding_sources_created_at_idx" ON ${schema}."payload_membership_funding_sources" USING btree ("created_at");

  -- Indexes: Membership Reconciliations
  CREATE INDEX "payload_membership_reconciliations_support_id_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("support_id");
  CREATE INDEX "payload_membership_reconciliations_stripe_event_id_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("stripe_event_id");
  CREATE INDEX "payload_membership_reconciliations_stripe_event_type_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("stripe_event_type");
  CREATE INDEX "payload_membership_reconciliations_reconciliation_state_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("reconciliation_state");
  CREATE INDEX "payload_membership_reconciliations_failure_code_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("failure_code");
  CREATE INDEX "payload_membership_reconciliations_updated_at_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("updated_at");
  CREATE INDEX "payload_membership_reconciliations_created_at_idx" ON ${schema}."payload_membership_reconciliations" USING btree ("created_at");

  -- Indexes: Membership Review Queue Items
  CREATE INDEX "payload_membership_review_queue_items_support_id_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("support_id");
  CREATE INDEX "payload_membership_review_queue_items_queue_state_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("queue_state");
  CREATE INDEX "payload_membership_review_queue_items_queue_reason_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("queue_reason");
  CREATE INDEX "payload_membership_review_queue_items_assigned_to_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("assigned_to");
  CREATE INDEX "payload_membership_review_queue_items_priority_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("priority");
  CREATE INDEX "payload_membership_review_queue_items_updated_at_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("updated_at");
  CREATE INDEX "payload_membership_review_queue_items_created_at_idx" ON ${schema}."payload_membership_review_queue_items" USING btree ("created_at");

  -- Indexes: Operator Notes
  CREATE INDEX "payload_operator_notes_target_type_target_id_idx" ON ${schema}."payload_operator_notes" USING btree ("target_type", "target_id");
  CREATE INDEX "payload_operator_notes_target_id_idx" ON ${schema}."payload_operator_notes" USING btree ("target_id");
  CREATE INDEX "payload_operator_notes_author_idx" ON ${schema}."payload_operator_notes" USING btree ("author");
  CREATE INDEX "payload_operator_notes_visibility_idx" ON ${schema}."payload_operator_notes" USING btree ("visibility");
  CREATE INDEX "payload_operator_notes_pinned_idx" ON ${schema}."payload_operator_notes" USING btree ("pinned") WHERE "pinned" = true;
  CREATE INDEX "payload_operator_notes_updated_at_idx" ON ${schema}."payload_operator_notes" USING btree ("updated_at");
  CREATE INDEX "payload_operator_notes_created_at_idx" ON ${schema}."payload_operator_notes" USING btree ("created_at");

  -- Indexes: Membership Audit History (Append-only, queryable by actor/action/collection)
  CREATE INDEX "payload_membership_audit_history_actor_type_actor_id_idx" ON ${schema}."payload_membership_audit_history" USING btree ("actor_type", "actor_id");
  CREATE INDEX "payload_membership_audit_history_action_idx" ON ${schema}."payload_membership_audit_history" USING btree ("action");
  CREATE INDEX "payload_membership_audit_history_target_collection_target_id_idx" ON ${schema}."payload_membership_audit_history" USING btree ("target_collection", "target_id");
  CREATE INDEX "payload_membership_audit_history_severity_idx" ON ${schema}."payload_membership_audit_history" USING btree ("severity");
  CREATE INDEX "payload_membership_audit_history_approval_reference_idx" ON ${schema}."payload_membership_audit_history" USING btree ("approval_reference");
  CREATE INDEX "payload_membership_audit_history_created_at_idx" ON ${schema}."payload_membership_audit_history" USING btree ("created_at");

  -- Indexes: Stripe Shadow Projections
  CREATE INDEX "payload_stripe_shadow_projections_stripe_customer_id_idx" ON ${schema}."payload_stripe_shadow_projections" USING btree ("stripe_customer_id");
  CREATE INDEX "payload_stripe_shadow_projections_stripe_subscription_id_idx" ON ${schema}."payload_stripe_shadow_projections" USING btree ("stripe_subscription_id");
  CREATE INDEX "payload_stripe_shadow_projections_stripe_event_id_idx" ON ${schema}."payload_stripe_shadow_projections" USING btree ("stripe_event_id");
  CREATE INDEX "payload_stripe_shadow_projections_shadow_state_idx" ON ${schema}."payload_stripe_shadow_projections" USING btree ("shadow_state");
  CREATE INDEX "payload_stripe_shadow_projections_updated_at_idx" ON ${schema}."payload_stripe_shadow_projections" USING btree ("updated_at");
  CREATE INDEX "payload_stripe_shadow_projections_created_at_idx" ON ${schema}."payload_stripe_shadow_projections" USING btree ("created_at");
  `
}

export function buildMembershipSupportMigrationDownSql(databaseUrl = process.env.DATABASE_URL): string {
  const schema = getMembershipSupportMigrationSchemaSqlPrefix(databaseUrl)

  return `
  -- Membership Support Schema Rollback: Drop all tables (cascade handles dependencies)
  DROP TABLE IF EXISTS ${schema}."payload_stripe_shadow_projections" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_membership_audit_history" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_operator_notes" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_membership_review_queue_items" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_membership_reconciliations" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_membership_funding_sources" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_pay_it_forward_funding" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_membership_vouchers" CASCADE;
  DROP TABLE IF EXISTS ${schema}."payload_membership_support_records" CASCADE;

  -- Drop all enums
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_support_records_funding_source" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_support_records_voucher_duration" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_support_records_issuance_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_support_records_billing_cadence" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_support_records_reconciliation_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_vouchers_approval_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_vouchers_redemption_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_vouchers_voucher_duration" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_vouchers_billing_cadence" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_pay_it_forward_funding_approval_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_pay_it_forward_funding_billing_cadence" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_funding_sources_source_type" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_funding_sources_source_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_reconciliations_reconciliation_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_review_queue_items_queue_state" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_review_queue_items_queue_reason" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_audit_history_actor_type" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_membership_audit_history_severity" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_operator_notes_target_type" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_operator_notes_visibility" CASCADE;
  DROP TYPE IF EXISTS ${schema}."enum_payload_stripe_shadow_projections_shadow_state" CASCADE;
  `
}
