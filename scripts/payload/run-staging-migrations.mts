import { spawnSync } from 'node:child_process'

import {
  parseStagingDatabaseUrl,
  resolveMode,
} from './staging-migration-boundary'

export function runStagingPayloadMigration(
  argv = process.argv.slice(2),
  databaseUrl = process.env.DATABASE_URL,
): never {
  const mode = resolveMode(argv)
  const target = parseStagingDatabaseUrl(databaseUrl)

  console.log(`[payload-staging] host=${target.hostname}`)
  console.log(`[payload-staging] database=${target.database}`)
  console.log(`[payload-staging] schema=${target.schema}`)
  console.log(`[payload-staging] mode=${mode}`)

  const payloadCommand = mode === 'status' ? 'migrate:status' : 'migrate'
  const result = spawnSync('pnpm', ['payload', payloadCommand], {
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStagingPayloadMigration()
}
