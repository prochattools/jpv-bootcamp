const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const REQUIRED_DATABASE = 'jpvbootcamp'

export type StagingMigrationMode = 'status' | 'apply'

export type StagingDatabaseTarget = {
  hostname: string
  database: string
  schema: string
}

export function resolveMode(argv: string[]): StagingMigrationMode {
  const hasStatus = argv.includes('--status')
  const hasApply = argv.includes('--apply')

  if (hasStatus === hasApply) {
    throw new Error('Choose exactly one mode: --status or --apply')
  }

  return hasStatus ? 'status' : 'apply'
}

export function parseStagingDatabaseUrl(
  databaseUrl: string | undefined,
): StagingDatabaseTarget {
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL is malformed')
  }

  const schema = parsed.searchParams.get('schema')
  if (schema !== REQUIRED_SCHEMA) {
    throw new Error(`Refusing Payload migration: schema must be exactly ${REQUIRED_SCHEMA}`)
  }

  const database = parsed.pathname.replace(/^\//, '')
  if (!database) throw new Error('DATABASE_URL database name is missing')
  if (database !== REQUIRED_DATABASE) {
    throw new Error(`Refusing Payload migration: database must be exactly ${REQUIRED_DATABASE}`)
  }

  return {
    hostname: parsed.hostname,
    database,
    schema,
  }
}
