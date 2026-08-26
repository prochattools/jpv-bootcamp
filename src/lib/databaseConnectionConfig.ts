export const REQUIRED_STAGING_SCHEMA = 'jpvbootcamp_staging'
export const REQUIRED_PRODUCTION_SCHEMA = 'jpvbootcamp'
const SAFE_SCHEMA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

export type DatabaseConnectionConfig = {
  connectionString: string
  schema: string
  metadata: {
    configured: boolean
    protocol: string | null
    credentialsPresent: boolean
    schemaSource: 'override' | 'url' | 'unconfigured'
  }
}

export function validateDatabaseSchemaIdentifier(value: string): string {
  const schema = value.trim()
  if (!SAFE_SCHEMA_IDENTIFIER.test(schema)) {
    throw new Error('Database schema identifier is invalid')
  }
  return schema
}

/**
 * Validates that rawUrl is a structurally sound PostgreSQL connection URL.
 * Rejects: wrong protocol, userinfo tricks (host in username), missing host,
 * missing database path, duplicate or missing schema param.
 */
function parseAndValidatePostgresUrl(rawUrl: string): {
  connectionString: string
  schema: string | null
  protocol: string
  credentialsPresent: boolean
  host: string
  port: string
  database: string
} {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: must use PostgreSQL protocol (postgresql:// or postgres://)`)
  }

  const protocol = parsed.protocol
  if (protocol !== 'postgresql:' && protocol !== 'postgres:') {
    throw new Error(
      `DATABASE_URL must use PostgreSQL protocol (postgresql:// or postgres://), got: ${protocol}`,
    )
  }

  const host = parsed.hostname
  if (!host) {
    throw new Error('DATABASE_URL must include a hostname')
  }

  // Guard against userinfo tricks: reject if username contains '@' or '/' that survive URL parsing
  const username = parsed.username
  if (username.includes('@') || username.includes('/')) {
    throw new Error('DATABASE_URL contains malformed userinfo')
  }

  const database = parsed.pathname.replace(/^\//, '')
  if (!database) {
    throw new Error('DATABASE_URL must include a database name in the path (e.g. postgresql://host/dbname)')
  }
  if (database.includes('/')) {
    throw new Error('DATABASE_URL database path must not contain additional path segments')
  }

  const port = parsed.port || (protocol === 'postgresql:' ? '5432' : '5432')
  const credentialsPresent = Boolean(parsed.username || parsed.password)

  // Require exactly one schema parameter — reject missing and reject duplicates
  const allParams = [...parsed.searchParams.entries()]
  const schemaParams = allParams.filter(([k]) => k === 'schema')
  if (schemaParams.length === 0) {
    throw new Error(
      `DATABASE_URL must include exactly one schema parameter (e.g. ?schema=${REQUIRED_STAGING_SCHEMA})`,
    )
  }
  if (schemaParams.length > 1) {
    throw new Error('DATABASE_URL must include exactly one schema parameter — duplicates are not permitted')
  }

  const rawSchema = schemaParams[0][1].trim()
  if (!rawSchema) {
    throw new Error('DATABASE_URL schema parameter must not be empty')
  }

  // Remove schema from connection string (drivers resolve it separately)
  const cleanUrl = new URL(rawUrl)
  cleanUrl.searchParams.delete('schema')
  const connectionString = cleanUrl.toString()

  return {
    connectionString,
    schema: rawSchema,
    protocol,
    credentialsPresent,
    host,
    port,
    database,
  }
}

/**
 * Resolves and validates a database connection config from the given URL and
 * optional schema override. For configured URLs: requires PostgreSQL protocol,
 * hostname, database path, and exactly one schema parameter. Never silently
 * substitutes a schema — missing schema rejects with an error. Schema override
 * replaces the URL schema value and must also be an explicit identifier.
 *
 * When DATABASE_URL is absent (build-time / unconfigured), returns an
 * unconfigured config so module evaluation does not throw at build time.
 * Call assertStagingSchema() at server startup to enforce the boundary.
 */
export function resolveDatabaseConnectionConfig(
  rawUrl: string | undefined,
  schemaOverride: string | undefined,
): DatabaseConnectionConfig {
  const override = schemaOverride?.trim()

  if (!rawUrl) {
    return {
      connectionString: '',
      schema: REQUIRED_STAGING_SCHEMA,
      metadata: {
        configured: false,
        protocol: null,
        credentialsPresent: false,
        schemaSource: 'unconfigured',
      },
    }
  }

  const parsed = parseAndValidatePostgresUrl(rawUrl)
  let schema = validateDatabaseSchemaIdentifier(parsed.schema)
  let schemaSource: DatabaseConnectionConfig['metadata']['schemaSource'] = 'url'

  if (override) {
    schema = validateDatabaseSchemaIdentifier(override)
    schemaSource = 'override'
  }

  return {
    connectionString: parsed.connectionString,
    schema,
    metadata: {
      configured: true,
      protocol: parsed.protocol,
      credentialsPresent: parsed.credentialsPresent,
      schemaSource,
    },
  }
}

/**
 * Asserts the resolved config targets the required staging schema.
 * Call at server startup — not at module evaluation — to enforce the runtime boundary.
 */
export function assertStagingSchema(config: DatabaseConnectionConfig): void {
  if (!config.metadata.configured) {
    throw new Error(
      `DATABASE_URL is required at runtime. Schema must be exactly '${REQUIRED_STAGING_SCHEMA}'.`,
    )
  }
  if (config.schema !== REQUIRED_STAGING_SCHEMA) {
    throw new Error(
      `Schema '${config.schema}' is not permitted. Only '${REQUIRED_STAGING_SCHEMA}' is allowed in this staging operational lane.`,
    )
  }
}

/**
 * Asserts that the resolved config targets the explicit production schema.
 * Production is intentionally separate from the preview/staging boundary.
 */
export function assertProductionSchema(config: DatabaseConnectionConfig): void {
  if (!config.metadata.configured) {
    throw new Error(
      `DATABASE_URL is required at runtime. Schema must be exactly '${REQUIRED_PRODUCTION_SCHEMA}'.`,
    )
  }
  if (config.schema !== REQUIRED_PRODUCTION_SCHEMA) {
    throw new Error(
      `Schema '${config.schema}' is not permitted. Production requires '${REQUIRED_PRODUCTION_SCHEMA}'.`,
    )
  }
}

export function quoteDatabaseIdentifier(value: string): string {
  return `"${validateDatabaseSchemaIdentifier(value)}"`
}
