import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/**
 * Add missing foreign-key columns to payload_locked_documents_rels for all
 * new collections that were added after the initial schema setup.
 *
 * Payload auto-generates this rels table with one nullable integer FK column
 * per collection. Our custom migrations create the collection tables but do
 * not update the rels table. This migration closes that gap.
 *
 * Also creates payload_membership_administration_actions if it does not exist
 * (its table was never created by a prior migration).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	// Create payload_membership_administration_actions table if absent
	await db.execute(sql.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = '${schema.replace(/"/g, '')}'
          AND table_name = 'payload_membership_administration_actions'
      ) THEN
        CREATE TABLE ${schema}."payload_membership_administration_actions" (
          "id" serial PRIMARY KEY NOT NULL,
          "display_name" varchar NOT NULL,
          "action_type" varchar NOT NULL,
          "action_state" varchar NOT NULL DEFAULT 'pending',
          "approval_reference" varchar,
          "executed_at" timestamp(3) with time zone,
          "completed_at" timestamp(3) with time zone,
          "failure_reason" text,
          "notes" text,
          "metadata" jsonb,
          "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
          "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "payload_membership_administration_actions_approval_reference_idx"
          ON ${schema}."payload_membership_administration_actions" ("approval_reference");
      END IF;
    END $$;
  `))

	// Add missing FK columns to payload_locked_documents_rels
	const newCollections: Array<{ col: string; ref: string }> = [
		{ col: 'bunny_videos_id', ref: 'bunny_videos' },
		{ col: 'live_sessions_id', ref: 'live_sessions' },
		{ col: 'payload_membership_administration_actions_id', ref: 'payload_membership_administration_actions' },
		{ col: 'payload_membership_audit_history_id', ref: 'payload_membership_audit_history' },
		{ col: 'payload_membership_funding_sources_id', ref: 'payload_membership_funding_sources' },
		{ col: 'payload_membership_reconciliations_id', ref: 'payload_membership_reconciliations' },
		{ col: 'payload_membership_review_queue_items_id', ref: 'payload_membership_review_queue_items' },
		{ col: 'payload_membership_support_records_id', ref: 'payload_membership_support_records' },
		{ col: 'payload_membership_vouchers_id', ref: 'payload_membership_vouchers' },
		{ col: 'payload_operator_notes_id', ref: 'payload_operator_notes' },
		{ col: 'payload_partner_affiliates_id', ref: 'payload_partner_affiliates' },
		{ col: 'payload_partner_applications_id', ref: 'payload_partner_applications' },
		{ col: 'payload_partner_events_id', ref: 'payload_partner_events' },
		{ col: 'payload_pay_it_forward_funding_id', ref: 'payload_pay_it_forward_funding' },
		{ col: 'payload_stripe_shadow_projections_id', ref: 'payload_stripe_shadow_projections' },
	]

	for (const { col, ref } of newCollections) {
		await db.execute(sql.raw(`
      ALTER TABLE ${schema}."payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "${col}" integer
          REFERENCES ${schema}."${ref}" ("id") ON DELETE CASCADE;
    `))
	}
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	const cols = [
		'bunny_videos_id',
		'live_sessions_id',
		'payload_membership_administration_actions_id',
		'payload_membership_audit_history_id',
		'payload_membership_funding_sources_id',
		'payload_membership_reconciliations_id',
		'payload_membership_review_queue_items_id',
		'payload_membership_support_records_id',
		'payload_membership_vouchers_id',
		'payload_operator_notes_id',
		'payload_partner_affiliates_id',
		'payload_partner_applications_id',
		'payload_partner_events_id',
		'payload_pay_it_forward_funding_id',
		'payload_stripe_shadow_projections_id',
	]

	for (const col of cols) {
		await db.execute(sql.raw(`
      ALTER TABLE ${schema}."payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "${col}";
    `))
	}
}
