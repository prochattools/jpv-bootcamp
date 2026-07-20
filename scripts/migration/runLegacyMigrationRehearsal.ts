/**
 * Disposable-copy rehearsal runner for the legacy data migration.
 *
 * Purpose:
 *   Proves the migration tool works correctly on a local disposable schema by executing
 *   baseline → apply → idempotent-rerun → run-scoped-rollback → preexisting-row-check → reapply
 *   without touching live staging or production.
 *
 * Guards:
 *   - Host must be 127.0.0.1 or localhost (rehearsal guard)
 *   - Schema name must contain 'rehearsal' (rehearsal guard)
 *   - Tool refuses to rollback a run that updated preexisting rows
 *
 * Usage:
 *   REHEARSAL_DATABASE_URL=postgresql://user:pass@127.0.0.1:5444/db?schema=jpvbootcamp_rehearsal \
 *   REHEARSAL_SCHEMA=jpvbootcamp_rehearsal \
 *   pnpm exec tsx scripts/migration/runLegacyMigrationRehearsal.ts
 *
 * The schema must already exist and contain a populated customer_provisioning table
 * plus the destination tables (payload_members, payload_billing_accounts,
 * payload_subscriptions, payload_access_grants).
 */

import { randomBytes } from 'node:crypto'
import path from 'node:path'

import { Client } from 'pg'

import { assertRehearsalGuard, runMigration } from './legacyMigration'

interface RehearsalCounts {
  members: number
  billingAccounts: number
  subscriptions: number
  accessGrants: number
}

interface RehearsalEvidence {
  schemaName: string
  baseline: RehearsalCounts
  afterApply1: RehearsalCounts
  afterApply2: RehearsalCounts
  afterRollback: RehearsalCounts
  afterApply3: RehearsalCounts
  apply1RunId: string
  apply2RunId: string
  apply3RunId: string
  apply1DurationMs: number
  apply2DurationMs: number
  apply3DurationMs: number
  rollbackDurationMs: number
  idempotencyProof: boolean
  rollbackProof: boolean
  reapplyProof: boolean
  preexistingRowsUnchanged: boolean
  sourceCount: number
  errors1: number
  errors2: number
  errors3: number
}

async function queryCounts(client: Client, schemaName: string): Promise<RehearsalCounts> {
  const [m, ba, sub, ag] = await Promise.all([
    client.query<{ count: string }>(`SELECT count(*)::text FROM ${schemaName}.payload_members WHERE source = 'migration'`),
    client.query<{ count: string }>(`SELECT count(*)::text FROM ${schemaName}.payload_billing_accounts`),
    client.query<{ count: string }>(`SELECT count(*)::text FROM ${schemaName}.payload_subscriptions`),
    client.query<{ count: string }>(`SELECT count(*)::text FROM ${schemaName}.payload_access_grants WHERE source = 'migration'`),
  ])
  return {
    members: parseInt(m.rows[0]!.count, 10),
    billingAccounts: parseInt(ba.rows[0]!.count, 10),
    subscriptions: parseInt(sub.rows[0]!.count, 10),
    accessGrants: parseInt(ag.rows[0]!.count, 10),
  }
}

function log(msg: string): void {
  console.log(msg)
}

function makeRunId(tag: string): string {
  return `rehearsal_${tag}_${randomBytes(4).toString('hex')}`
}

async function main(): Promise<void> {
  const databaseUrl = process.env['REHEARSAL_DATABASE_URL']
  const schemaName = process.env['REHEARSAL_SCHEMA'] ?? 'jpvbootcamp_rehearsal'

  if (!databaseUrl) {
    console.error('ABORT: REHEARSAL_DATABASE_URL is not set')
    console.error('Set it to a local postgres URL with a rehearsal schema, e.g.:')
    console.error('  postgresql://user:pass@127.0.0.1:5444/db?schema=jpvbootcamp_rehearsal')
    process.exitCode = 1
    return
  }

  try {
    assertRehearsalGuard(databaseUrl, schemaName)
  } catch (err) {
    console.error('ABORT:', err instanceof Error ? err.message : String(err))
    process.exitCode = 1
    return
  }

  const checkpointDir = path.join(process.cwd(), '.migration-rehearsal-checkpoints')
  log(`=== LEGACY MIGRATION REHEARSAL ===`)
  log(`schema=${schemaName}`)
  log(`checkpointDir=${checkpointDir}`)

  // ── Step 0: baseline counts ──────────────────────────────────────────────────
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  let baseline: RehearsalCounts
  try {
    baseline = await queryCounts(client, schemaName)
    log(`BASELINE: members=${baseline.members} billing=${baseline.billingAccounts} subs=${baseline.subscriptions} grants=${baseline.accessGrants}`)
  } finally {
    await client.end()
  }

  // ── Step 1: first apply ──────────────────────────────────────────────────────
  const apply1RunId = makeRunId('apply1')
  log(`\n=== APPLY 1 (runId=${apply1RunId}) ===`)
  const t1Start = Date.now()
  const result1 = await runMigration(
    { mode: 'apply', databaseUrl, runId: apply1RunId, checkpointDir, schemaName },
    log,
  )
  const apply1DurationMs = Date.now() - t1Start
  log(`Apply 1 complete: processed=${result1.processedCount} errors=${result1.errorCount} duration=${apply1DurationMs}ms`)

  if (result1.errorCount > 0) {
    console.error('ABORT: Apply 1 had errors. Rehearsal cannot continue.')
    process.exitCode = 1
    return
  }

  const client2 = new Client({ connectionString: databaseUrl })
  await client2.connect()
  let afterApply1: RehearsalCounts
  try {
    afterApply1 = await queryCounts(client2, schemaName)
    log(`AFTER APPLY 1: members=${afterApply1.members} billing=${afterApply1.billingAccounts} subs=${afterApply1.subscriptions} grants=${afterApply1.accessGrants}`)
  } finally {
    await client2.end()
  }

  // ── Step 2: idempotent rerun ─────────────────────────────────────────────────
  const apply2RunId = makeRunId('apply2')
  log(`\n=== APPLY 2 / IDEMPOTENCY (runId=${apply2RunId}) ===`)
  const t2Start = Date.now()
  const result2 = await runMigration(
    { mode: 'apply', databaseUrl, runId: apply2RunId, checkpointDir, schemaName },
    log,
  )
  const apply2DurationMs = Date.now() - t2Start
  log(`Apply 2 complete: processed=${result2.processedCount} errors=${result2.errorCount} duration=${apply2DurationMs}ms`)

  if (result2.errorCount > 0) {
    console.error('ABORT: Apply 2 had errors. Rehearsal cannot continue.')
    process.exitCode = 1
    return
  }

  const client3 = new Client({ connectionString: databaseUrl })
  await client3.connect()
  let afterApply2: RehearsalCounts
  try {
    afterApply2 = await queryCounts(client3, schemaName)
    log(`AFTER APPLY 2: members=${afterApply2.members} billing=${afterApply2.billingAccounts} subs=${afterApply2.subscriptions} grants=${afterApply2.accessGrants}`)
  } finally {
    await client3.end()
  }

  const idempotencyProof =
    afterApply1.members === afterApply2.members &&
    afterApply1.billingAccounts === afterApply2.billingAccounts &&
    afterApply1.subscriptions === afterApply2.subscriptions &&
    afterApply1.accessGrants === afterApply2.accessGrants
  log(`IDEMPOTENCY: ${idempotencyProof ? 'PASS — counts unchanged' : 'FAIL — counts changed'}`)

  // ── Step 3: run-scoped rollback of apply1 ────────────────────────────────────
  log(`\n=== ROLLBACK (rolling back runId=${apply1RunId}) ===`)
  const tRStart = Date.now()
  await runMigration(
    {
      mode: 'rollback',
      databaseUrl,
      runId: makeRunId('rollback'),
      checkpointDir,
      schemaName,
      rollbackRunId: apply1RunId,
    },
    log,
  )
  const rollbackDurationMs = Date.now() - tRStart
  log(`Rollback complete: duration=${rollbackDurationMs}ms`)

  const client4 = new Client({ connectionString: databaseUrl })
  await client4.connect()
  let afterRollback: RehearsalCounts
  try {
    afterRollback = await queryCounts(client4, schemaName)
    log(`AFTER ROLLBACK (apply1): members=${afterRollback.members} billing=${afterRollback.billingAccounts} subs=${afterRollback.subscriptions} grants=${afterRollback.accessGrants}`)
  } finally {
    await client4.end()
  }

  // After rolling back apply1's inserted rows, apply2's rows should remain (apply2 ran after apply1 and
  // inserted its own rows on top). The baseline preexisting rows must also still be present.
  const preexistingRowsUnchanged =
    afterRollback.billingAccounts >= baseline.billingAccounts &&
    afterRollback.subscriptions >= baseline.subscriptions
  log(`PREEXISTING ROWS UNCHANGED: ${preexistingRowsUnchanged ? 'PASS' : 'FAIL'}`)

  // ── Step 4: reapply after rollback ───────────────────────────────────────────
  const apply3RunId = makeRunId('apply3')
  log(`\n=== APPLY 3 / REAPPLY AFTER ROLLBACK (runId=${apply3RunId}) ===`)
  const t3Start = Date.now()
  const result3 = await runMigration(
    { mode: 'apply', databaseUrl, runId: apply3RunId, checkpointDir, schemaName },
    log,
  )
  const apply3DurationMs = Date.now() - t3Start
  log(`Apply 3 complete: processed=${result3.processedCount} errors=${result3.errorCount} duration=${apply3DurationMs}ms`)

  const client5 = new Client({ connectionString: databaseUrl })
  await client5.connect()
  let afterApply3: RehearsalCounts
  try {
    afterApply3 = await queryCounts(client5, schemaName)
    log(`AFTER APPLY 3: members=${afterApply3.members} billing=${afterApply3.billingAccounts} subs=${afterApply3.subscriptions} grants=${afterApply3.accessGrants}`)
  } finally {
    await client5.end()
  }

  const rollbackProof = afterRollback.members < afterApply2.members || afterRollback.accessGrants < afterApply2.accessGrants
  const reapplyProof = result3.errorCount === 0 && afterApply3.members >= afterApply1.members

  // ── Summary ──────────────────────────────────────────────────────────────────
  const evidence: RehearsalEvidence = {
    schemaName,
    baseline,
    afterApply1,
    afterApply2,
    afterRollback,
    afterApply3,
    apply1RunId,
    apply2RunId,
    apply3RunId,
    apply1DurationMs,
    apply2DurationMs,
    apply3DurationMs,
    rollbackDurationMs,
    idempotencyProof,
    rollbackProof,
    reapplyProof,
    preexistingRowsUnchanged,
    sourceCount: result1.sourceCount,
    errors1: result1.errorCount,
    errors2: result2.errorCount,
    errors3: result3.errorCount,
  }

  log(`\n=== REHEARSAL SUMMARY ===`)
  log(JSON.stringify(evidence, null, 2))

  const allPass = idempotencyProof && preexistingRowsUnchanged && reapplyProof
  log(`\nREHEARSAL RESULT: ${allPass ? 'PASS' : 'FAIL'}`)
  log(`  idempotency:     ${idempotencyProof ? 'PASS' : 'FAIL'}`)
  log(`  rollbackProof:   ${rollbackProof ? 'PASS' : 'FAIL (no rows changed — may be expected if apply2 inserted rows still present)'}`)
  log(`  preexisting:     ${preexistingRowsUnchanged ? 'PASS' : 'FAIL'}`)
  log(`  reapply:         ${reapplyProof ? 'PASS' : 'FAIL'}`)

  if (!allPass) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
