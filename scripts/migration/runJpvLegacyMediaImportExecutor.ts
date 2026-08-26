#!/usr/bin/env node

import { readFileSync } from 'node:fs'

import {
  assertRealSourceContentExpectations,
  assertSnapshotExpectations,
  buildLegacyDryRunNormalization,
  buildLegacySqlSnapshot,
  buildLocalMediaManifest,
  parseWordPressWxr,
  reconcileWordPressAttachments,
  type BunnyInventoryFile,
  type StripeEvidenceFile,
} from './legacySourceDryRun'
import { buildLegacyPayloadOperationPlan } from './legacyPayloadOperationPlan'
import { assertLegacyMediaImportManifest, buildLegacyMediaImportManifest } from './legacyMediaImportManifest'
import { buildLegacyMediaImportExecutionPlan } from './legacyMediaImportExecutionPlan'
import { runJpvLegacyMediaImport } from './jpvLegacyMediaImportExecutor'

interface CliArgs {
  mode: 'dry-run' | 'apply'
  sql: string
  wxr: string
  stripe: string
  bunny: string
  uploads: string
  acquiredMap?: string
  runId: string
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    if (arg === '--jpv-private-tmp') {
      values.set('sql', '/private/tmp/127_0_0_1.sql')
      values.set('wxr', '/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml')
      values.set('stripe', '/private/tmp/jpv-stripe-live-subscriptions.json')
      values.set('bunny', '/private/tmp/jpv-bunny-migration-inventory.json')
      values.set('uploads', 'src/assets/uploads')
      continue
    }
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq >= 0) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1))
      continue
    }
    const key = arg.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`MISSING_VALUE --${key}`)
    values.set(key, value)
    index += 1
  }
  const mode = values.get('mode')
  if (mode !== 'dry-run' && mode !== 'apply') throw new Error('MISSING_OR_INVALID --mode=dry-run|apply')
  for (const key of ['sql', 'wxr', 'stripe', 'bunny', 'uploads'] as const) {
    if (!values.get(key)) throw new Error(`MISSING_REQUIRED_ARGUMENT --${key}`)
  }
  return {
    mode,
    sql: values.get('sql')!,
    wxr: values.get('wxr')!,
    stripe: values.get('stripe')!,
    bunny: values.get('bunny')!,
    uploads: values.get('uploads')!,
    ...(values.get('acquired-map') ? { acquiredMap: values.get('acquired-map')! } : {}),
    runId: values.get('run-id') ?? `jpv-media-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL ?? (
    args.mode === 'dry-run'
      ? 'postgresql://dry-run:dry-run@10.0.2.4:5432/jpvbootcamp?schema=jpvbootcamp_staging'
      : undefined
  )
  if (!databaseUrl) throw new Error('DATABASE_URL_REQUIRED')

  const snapshot = buildLegacySqlSnapshot(readFileSync(args.sql, 'utf8'))
  const normalization = buildLegacyDryRunNormalization(snapshot, readJson<StripeEvidenceFile>(args.stripe))
  assertSnapshotExpectations(normalization.identity)
  const wxrItems = parseWordPressWxr(readFileSync(args.wxr, 'utf8'))
  const localMedia = buildLocalMediaManifest(args.uploads)
  assertRealSourceContentExpectations(snapshot, normalization, wxrItems, localMedia)
  const attachments = reconcileWordPressAttachments(wxrItems, localMedia)
  const operationPlan = await buildLegacyPayloadOperationPlan(snapshot, normalization, readJson<BunnyInventoryFile>(args.bunny))
  const manifest = buildLegacyMediaImportManifest({ operationPlan, localMedia, attachments })
  assertLegacyMediaImportManifest(manifest)
  const executionPlan = buildLegacyMediaImportExecutionPlan({ manifest, operationPlan })
  const acquiredSourcePaths = args.acquiredMap ? readJson<Record<string, string>>(args.acquiredMap) : undefined

  const result = await runJpvLegacyMediaImport({
    mode: args.mode,
    databaseUrl,
    runId: args.runId,
    executionPlan,
    sourceUploadsRoot: args.uploads,
    ...(acquiredSourcePaths ? { acquiredSourcePaths } : {}),
  })

  process.stdout.write(`${JSON.stringify({
    ok: result.ok,
    mode: result.mode,
    runId: result.runId,
    canonicalMigrationCount: result.canonicalMigrationCount,
    executionIntents: result.executionIntents,
    localReady: result.localReady,
    remoteAcquisitionRequired: result.remoteAcquisitionRequired,
    blocked: result.blocked,
    applied: result.applied,
    alreadyApplied: result.alreadyApplied,
    failed: result.failed,
    resolutionCount: result.resolutions.length,
  }, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
