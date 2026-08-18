#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  assertPiiOutputOutsideRepo,
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
import { buildLegacyRemoteMediaAcquisitionPlan } from './legacyRemoteMediaAcquisitionPlan'

interface CliArgs {
  sql: string
  wxr: string
  stripe: string
  bunny: string
  uploads: string
  out?: string
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    if (arg === '--jpv-private-tmp') {
      values.set('sql', '/private/tmp/127_0_0_1.sql')
      values.set('wxr', '/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml')
      values.set('stripe', '/private/tmp/jpv-stripe-live-subscriptions.json')
      values.set('bunny', '/private/tmp/jpv-bunny-migration-inventory.json')
      values.set('uploads', 'src/assets/uploads')
      continue
    }
    const eq = arg.indexOf('=')
    if (eq >= 0) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1))
      continue
    }
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`MISSING_VALUE --${key}`)
    values.set(key, value)
    i += 1
  }

  for (const key of ['sql', 'wxr', 'stripe', 'bunny', 'uploads'] as const) {
    if (!values.get(key)) throw new Error(`MISSING_REQUIRED_ARGUMENT --${key}`)
  }

  return {
    sql: values.get('sql')!,
    wxr: values.get('wxr')!,
    stripe: values.get('stripe')!,
    bunny: values.get('bunny')!,
    uploads: values.get('uploads')!,
    ...(values.get('out') ? { out: values.get('out')! } : {}),
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const sql = readFileSync(args.sql, 'utf8')
  const wxr = readFileSync(args.wxr, 'utf8')
  const stripe = readJson<StripeEvidenceFile>(args.stripe)
  const bunny = readJson<BunnyInventoryFile>(args.bunny)

  const snapshot = buildLegacySqlSnapshot(sql)
  const normalization = buildLegacyDryRunNormalization(snapshot, stripe)
  assertSnapshotExpectations(normalization.identity)
  const wxrItems = parseWordPressWxr(wxr)
  const localMedia = buildLocalMediaManifest(args.uploads)
  assertRealSourceContentExpectations(snapshot, normalization, wxrItems, localMedia)
  const attachments = reconcileWordPressAttachments(wxrItems, localMedia)
  const operationPlan = await buildLegacyPayloadOperationPlan(snapshot, normalization, bunny)
  const manifest = buildLegacyMediaImportManifest({ operationPlan, localMedia, attachments })
  assertLegacyMediaImportManifest(manifest)
  const executionPlan = buildLegacyMediaImportExecutionPlan({ manifest, operationPlan })
  const acquisitionPlan = buildLegacyRemoteMediaAcquisitionPlan({ executionPlan, manifest, operationPlan })

  const result = {
    mutationMode: 'none',
    networkAuthorized: false,
    outputWritten: Boolean(args.out),
    identity: {
      sourceMembers: normalization.identity.sourceMemberAccountCount,
      canonicalMembers: normalization.identity.canonicalMemberCount,
      activeMembers: normalization.identity.activeCount,
      blockedMembers: normalization.identity.blockedCount,
    },
    planner: {
      operations: operationPlan.summary.operations,
      blockedOperations: operationPlan.summary.blockedOperations,
      unresolvedRelationships: operationPlan.unresolved.length,
    },
    executionPlan: {
      executionIntents: executionPlan.summary.executionIntents,
      requiresRemoteSourceAcquisition: executionPlan.summary.requiresRemoteSourceAcquisition,
      schemaBlocked: executionPlan.summary.schemaBlocked,
    },
    remoteAcquisition: acquisitionPlan.summary,
  }

  if (args.out) {
    const outputPath = assertPiiOutputOutsideRepo(args.out)
    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(acquisitionPlan, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    chmodSync(outputPath, 0o600)
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
