#!/usr/bin/env node
/**
 * CLI entry point for the JPV legacy Payload import executor.
 *
 * Usage:
 *   pnpm exec tsx scripts/migration/runJpvLegacyImportExecutor.ts \
 *     --mode <dry-run|apply> \
 *     --jpv-private-tmp
 *
 *   OR with explicit paths:
 *   ... --mode dry-run --sql /path/to.sql --wxr /path/to.xml \
 *       --stripe /path/stripe.json --bunny /path/bunny.json \
 *       --uploads src/assets/uploads
 *
 * Hard guards (abort before any DB write):
 *   - DATABASE_URL host must be 10.0.2.4 or 100.71.31.88
 *   - DATABASE_URL schema must be jpvbootcamp_staging
 *   - DATABASE_URL database must be jpvbootcamp
 *   - Payload migration count must be exactly 33
 */

import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

import { Client } from 'pg'

import {
  buildLegacyDryRunNormalization,
  buildLegacySqlSnapshot,
  buildLocalMediaManifest,
  parseWordPressWxr,
  reconcileBunnyReferences,
  reconcileWordPressAttachments,
  type BunnyInventoryFile,
  type StripeEvidenceFile,
} from './legacySourceDryRun'
import { buildLegacyPayloadOperationPlan } from './legacyPayloadOperationPlan'
import {
  guardStagingIdentity,
  verifyPayloadMigrationCount,
  runJpvLegacyImport,
} from './jpvLegacyImportExecutor'

interface CliArgs {
  mode: 'dry-run' | 'apply'
  sql: string
  wxr: string
  stripe: string
  bunny: string
  uploads: string
}

function parseArgs(argv: string[]): CliArgs {
  const modeIdx = argv.indexOf('--mode')
  const mode = modeIdx >= 0 ? argv[modeIdx + 1] : undefined
  if (mode !== 'dry-run' && mode !== 'apply') {
    throw new Error('USAGE: --mode <dry-run|apply>')
  }

  if (argv.includes('--jpv-private-tmp')) {
    return {
      mode,
      sql: '/private/tmp/127_0_0_1.sql',
      wxr: '/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml',
      stripe: '/private/tmp/jpv-stripe-live-subscriptions.json',
      bunny: '/private/tmp/jpv-bunny-migration-inventory.json',
      uploads: 'src/assets/uploads',
    }
  }

  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq >= 0) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1))
      continue
    }
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) continue
    values.set(key, value)
    i += 1
  }

  const required = ['sql', 'wxr', 'stripe', 'bunny', 'uploads'] as const
  for (const key of required) {
    if (!values.get(key)) throw new Error(`MISSING_REQUIRED_ARGUMENT --${key}`)
  }

  return {
    mode,
    sql: values.get('sql')!,
    wxr: values.get('wxr')!,
    stripe: values.get('stripe')!,
    bunny: values.get('bunny')!,
    uploads: values.get('uploads')!,
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    process.stderr.write('ABORT: DATABASE_URL is not set\n')
    process.exitCode = 1
    return
  }

  // Staging identity guard — fast fail before connecting
  try {
    guardStagingIdentity(databaseUrl)
  } catch (err) {
    process.stderr.write(`ABORT: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
    return
  }

  // 33/33 migration check — connect briefly then close
  if (args.mode === 'apply') {
    const checkClient = new Client({ connectionString: databaseUrl })
    await checkClient.connect()
    let migrationCount = 0
    try {
      migrationCount = await verifyPayloadMigrationCount(checkClient, 'jpvbootcamp_staging')
    } finally {
      await checkClient.end()
    }
    if (migrationCount !== 33) {
      process.stderr.write(`ABORT: migration_count_mismatch: expected 33, got ${migrationCount}\n`)
      process.exitCode = 1
      return
    }
  }

  // Build operation plan from source files
  const sql = readFileSync(args.sql, 'utf8')
  const wxr = readFileSync(args.wxr, 'utf8')
  const stripe = readJson<StripeEvidenceFile>(args.stripe)
  const bunny = readJson<BunnyInventoryFile>(args.bunny)

  const snapshot = buildLegacySqlSnapshot(sql)
  const normalization = buildLegacyDryRunNormalization(snapshot, stripe)
  const wxrItems = parseWordPressWxr(wxr)
  const mediaManifest = buildLocalMediaManifest(args.uploads)
  reconcileWordPressAttachments(wxrItems, mediaManifest)
  reconcileBunnyReferences(normalization.bunnyReferences, bunny)
  const operationPlan = await buildLegacyPayloadOperationPlan(snapshot, normalization, bunny)

  const runId = `jpv_import_${args.mode}_${randomBytes(4).toString('hex')}_${Date.now()}`

  const result = await runJpvLegacyImport({
    mode: args.mode,
    databaseUrl,
    runId,
    operationPlan,
    output: (line) => process.stderr.write(`${line}\n`),
  })

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

  if (!result.ok || result.failedOperations > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
