#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { assertPiiOutputOutsideRepo, type BunnyInventoryFile } from './legacySourceDryRun'
import { readLegacyBunnyConfigFromEnv, verifyBunnyInventoryGuids } from './legacyBunnyReadOnly'

interface Args {
  input: string
  out: string
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
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
  const input = values.get('input')
  const out = values.get('out')
  if (!input) throw new Error('MISSING_REQUIRED_ARGUMENT --input')
  if (!out) throw new Error('MISSING_REQUIRED_ARGUMENT --out')
  return { input, out }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const outputPath = assertPiiOutputOutsideRepo(args.out)
  const inventory = JSON.parse(readFileSync(args.input, 'utf8')) as BunnyInventoryFile
  const config = readLegacyBunnyConfigFromEnv()

  if (inventory.library?.id !== undefined && String(inventory.library.id) !== config.libraryId) {
    throw new Error(`BUNNY_INPUT_LIBRARY_MISMATCH input=${inventory.library.id} configured=${config.libraryId}`)
  }

  const verified = await verifyBunnyInventoryGuids(inventory, config)
  const usable = verified.videos.filter((video) => video.status !== 'failed')
  if (verified.verification?.verified_guids !== usable.length) {
    throw new Error(`BUNNY_GUID_VERIFICATION_INCOMPLETE expected=${usable.length} actual=${verified.verification?.verified_guids ?? 0}`)
  }

  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(verified, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(outputPath, 0o600)

  process.stdout.write(`${JSON.stringify({
    mode: 'read_only_guid',
    libraryId: Number(config.libraryId),
    usableVideos: usable.length,
    verifiedGuids: verified.verification?.verified_guids ?? 0,
    failedVideosSkipped: verified.verification?.failed_videos_skipped ?? 0,
    numericVideoIdsRequired: false,
    output: path.basename(outputPath),
    mutationsPerformed: false,
  }, null, 2)}\n`)
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`LEGACY_BUNNY_READ_ONLY_VERIFICATION_FAILED ${message}\n`)
  process.exitCode = 1
})
