import { Client } from 'pg'

import {
  buildPayloadPreferencesDuplicateIdRepairApplySql,
  buildPayloadPreferencesDuplicateIdRepairDryRunSql,
  getPayloadPreferencesDuplicateIdRepairSchema,
} from '../../src/lib/payloadPreferencesDuplicateIdRepairSql'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

async function main(): Promise<void> {
  const mode = arg('mode') ?? 'dry-run'
  const confirm = arg('confirm')
  const databaseUrl = process.env.DATABASE_URL
  const schema = getPayloadPreferencesDuplicateIdRepairSchema(databaseUrl)

  console.log(`[payload-preferences-repair] schema=${schema}`)
  console.log(`[payload-preferences-repair] table=payload_preferences`)
  console.log(`[payload-preferences-repair] mode=${mode}`)

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const dryRunSql = buildPayloadPreferencesDuplicateIdRepairDryRunSql(databaseUrl)
    const dryRunResult = await client.query(dryRunSql)
    const row = dryRunResult.rows[0] as Record<string, unknown> | undefined
    if (!row) throw new Error('Dry-run returned no rows')

    const summary = {
      schema: row.schema,
      table: row.table,
      totalRowCount: Number(row.total_row_count ?? 0),
      duplicateGroupCount: Number(row.duplicate_group_count ?? 0),
      duplicateRowCount: Number(row.duplicate_row_count ?? 0),
      nullIdCount: Number(row.null_id_count ?? 0),
      currentMaxId: Number(row.current_max_id ?? 0),
      plannedReassignmentCount: Number(row.planned_reassignment_count ?? 0),
      safeStatus: String(row.safe_status ?? 'blocked'),
    }

    console.log(JSON.stringify(summary, null, 2))

    if (mode === 'dry-run') return
    if (mode !== 'apply') throw new Error('Choose --mode=dry-run or --mode=apply')
    if (confirm !== 'apply-staging-preferences-id-repair') {
      throw new Error('Confirmation phrase must be apply-staging-preferences-id-repair')
    }
    if (summary.schema !== 'jpvbootcamp_staging') throw new Error('wrong_schema_for_staging_migration')
    if (summary.nullIdCount !== 0) throw new Error('Null ids must be repaired before apply')
    if (summary.duplicateGroupCount === 0 || summary.plannedReassignmentCount <= 0) {
      throw new Error('No duplicate ids need repair')
    }
    if (summary.safeStatus !== 'dry_run_ready') throw new Error('Repair dry-run not ready')

    const applySql = buildPayloadPreferencesDuplicateIdRepairApplySql(databaseUrl)
    await client.query(applySql)
    console.log(JSON.stringify({ ok: true, applied: true, schema }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error((error as Error).message)
  process.exit(1)
})
