import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

const renameRelationshipTables = [
  'payload_membership_funding_sources',
  'payload_membership_reconciliations',
  'payload_membership_review_queue_items',
  'payload_membership_vouchers',
  'payload_operator_notes',
  'payload_pay_it_forward_funding',
  'payload_stripe_shadow_projections',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  const renames = renameRelationshipTables
    .map((table) => `ALTER TABLE ${schema}."${table}" RENAME COLUMN "support_id" TO "membership_support_id";`)
    .join('\n')

  await db.execute(sql.raw(`
    UPDATE ${schema}."payload_membership_audit_history"
      SET "membership_support_id" = COALESCE("membership_support_id", "support_id")
      WHERE "support_id" IS NOT NULL;
    ALTER TABLE ${schema}."payload_membership_audit_history" DROP COLUMN "support_id";

    ${renames}

    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_state" ADD VALUE IF NOT EXISTS 'in_review';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_state" ADD VALUE IF NOT EXISTS 'approved';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_state" ADD VALUE IF NOT EXISTS 'rejected';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_state" ADD VALUE IF NOT EXISTS 'closed';

    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_reason" ADD VALUE IF NOT EXISTS 'customer_restriction';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_reason" ADD VALUE IF NOT EXISTS 'expiry_check';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_reason" ADD VALUE IF NOT EXISTS 'idempotency_conflict';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_reason" ADD VALUE IF NOT EXISTS 'webhook_mismatch';
    ALTER TYPE ${schema}."enum_payload_membership_review_queue_items_queue_reason" ADD VALUE IF NOT EXISTS 'manual_override';
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  const renames = [...renameRelationshipTables]
    .reverse()
    .map((table) => `ALTER TABLE ${schema}."${table}" RENAME COLUMN "membership_support_id" TO "support_id";`)
    .join('\n')

  // PostgreSQL enum values cannot be removed safely in-place. The legacy values
  // remain accepted on rollback; only the relationship column names are restored.
  await db.execute(sql.raw(`
    ${renames}
    ALTER TABLE ${schema}."payload_membership_audit_history" ADD COLUMN "support_id" integer;
    UPDATE ${schema}."payload_membership_audit_history" SET "support_id" = "membership_support_id";
  `))
}
