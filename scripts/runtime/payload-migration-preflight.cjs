'use strict'

const { Client } = require('pg')

// Keep this list in exact registry order. The static regression test compares it to src/migrations/index.ts.
const REQUIRED_PAYLOAD_MIGRATIONS = [
  '20260620_213328',
  '20260621_194424_course_system_phase1',
  '20260622_093852_course_private_media',
  '20260627_010700_structured_community_attachments',
  '20260630_100730_affiliate_reporting',
  '20260630_190000_payload_preferences_id_constraint',
  '20260701_201500_member_email_verification',
  '20260702_001500_member_account_action_purposes',
  '20260703_000000_partner_affiliate_operations',
  '20260704_090000_partner_schema_reconciliation',
  '20260707_130000_remove_table_plan_from_payload_enums',
  '20260718_103726_membership_support_schema',
  '20260718_000000_live_sessions',
  '20260718_110000_bunny_videos',
  '20260719_150000_subscription_schema_cols',
  '20260720_000000_locked_docs_rels_new_collections',
  '20260722_100000_reconcile_lockstate_vip_progress',
  '20260723_000000_singular_membership_plan',
  '20260723_000001_migrate_pro_to_membership',
  '20260724_120000_operator_content_media',
  '20260724_121000_billing_operator_actions',
  '20260724_122000_live_session_relationships',
  '20260724_123000_email_operator_actions',
  '20260727_000000_partner_applications_source_member_id',
  '20260727_100000_email_events_lease_columns',
  '20260727_200000_email_events_processing_status',
  '20260730_090000_membership_audit_relationship_columns',
  '20260730_100000_email_events_staging_guard_status',
]

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const REQUIRED_AUDIT_HISTORY_COLUMNS = [
  'membership_support_id',
  'voucher_id',
  'funding_source_id',
  'reconciliation_id',
]

function resolveSchema(environment = process.env) {
  const override = environment.PAYLOAD_MIGRATION_SCHEMA?.trim()
  if (override) {
    if (!IDENTIFIER.test(override)) throw new Error('invalid_schema')
    return override
  }

  let schema = 'jpvbootcamp'
  try {
    const configured = new URL(environment.DATABASE_URL).searchParams.get('schema')
    if (configured) schema = configured
  } catch {
    throw new Error('database_url_unavailable')
  }
  if (!IDENTIFIER.test(schema)) throw new Error('invalid_schema')
  return schema
}

function missingMigrationNames(rows) {
  const applied = new Set(rows.map((row) => String(row.name)))
  return REQUIRED_PAYLOAD_MIGRATIONS.filter((name) => !applied.has(name))
}

async function verifyPayloadMigrationState({ environment = process.env, clientFactory = (options) => new Client(options) } = {}) {
  if (!environment.DATABASE_URL?.trim()) throw new Error('database_url_unavailable')
  const schema = resolveSchema(environment)
  const client = clientFactory({ connectionString: environment.DATABASE_URL })

  try {
    await client.connect()
    const result = await client.query(`SELECT "name" FROM "${schema}"."payload_migrations" WHERE "batch" <> -1`)
    const pending = missingMigrationNames(result.rows)
    if (pending.length > 0) return pending
    const columns = await client.query(
      'SELECT "column_name" FROM information_schema.columns WHERE "table_schema" = $1 AND "table_name" = $2',
      [schema, 'payload_membership_audit_history'],
    )
    const present = new Set(columns.rows.map((row) => String(row.column_name)))
    const missingColumns = REQUIRED_AUDIT_HISTORY_COLUMNS.filter((column) => !present.has(column))
    if (missingColumns.length > 0) throw new Error('audit_history_schema_incompatible')
    return []
  } catch (error) {
    if (error instanceof Error && error.message === 'audit_history_schema_incompatible') throw error
    throw new Error('migration_state_unavailable')
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function main() {
  try {
    const missing = await verifyPayloadMigrationState()
    if (missing.length > 0) {
      console.error(`[start] FATAL: Payload migrations are pending: ${missing.join(', ')}`)
      console.error('[start] Apply the reviewed environment-specific Payload migration job before application-only startup.')
      process.exitCode = 1
      return
    }
    console.log('[start] Payload migration state is current')
  } catch (error) {
    if (error instanceof Error && error.message === 'audit_history_schema_incompatible') {
      console.error('[start] FATAL: Payload audit-history schema is incomplete; apply the reviewed Payload migration before application-only startup.')
      process.exitCode = 1
      return
    }
    console.error('[start] FATAL: Payload migration state cannot be verified; application-only startup is blocked.')
    console.error('[start] Verify DATABASE_URL schema and run the reviewed environment-specific Payload migration job.')
    process.exitCode = 1
  }
}

if (require.main === module) void main()

module.exports = {
  REQUIRED_PAYLOAD_MIGRATIONS,
  REQUIRED_AUDIT_HISTORY_COLUMNS,
  missingMigrationNames,
  resolveSchema,
  verifyPayloadMigrationState,
}
