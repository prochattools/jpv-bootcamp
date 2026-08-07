export const REQUIRED_STAGING_SCHEMA = 'jpvbootcamp_staging'
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
 * Resolves and validates a database connection config from the given URL and
 * optional schema override. Requires an explicit schema — no default fallback.
 * At runtime, the operational staging boundary is enforced by start-staging.sh
 * which requires DATABASE_URL to contain schema=jpvbootcamp_staging exactly.
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

  let schema = REQUIRED_STAGING_SCHEMA
  let schemaSource: DatabaseConnectionConfig['metadata']['schemaSource'] = 'unconfigured'
  let connectionString = rawUrl
  let protocol: string | null = null
  let credentialsPresent = false

  try {
    const parsed = new URL(rawUrl)
    protocol = parsed.protocol || null
    credentialsPresent = Boolean(parsed.username || parsed.password)
    const urlSchema = parsed.searchParams.get('schema')?.trim()
    if (urlSchema) {
      schema = validateDatabaseSchemaIdentifier(urlSchema)
      schemaSource = 'url'
    }
    parsed.searchParams.delete('schema')
    connectionString = parsed.toString()
  } catch {
    connectionString = rawUrl
  }

  if (override) {
    schema = validateDatabaseSchemaIdentifier(override)
    schemaSource = 'override'
  }

  if (schemaSource === 'unconfigured') {
    schema = REQUIRED_STAGING_SCHEMA
  }

  return {
    connectionString,
    schema,
    metadata: {
      configured: true,
      protocol,
      credentialsPresent,
      schemaSource,
    },
  }
}

/**
 * Asserts the resolved config targets the required staging schema.
 * Call this at server startup (not at module evaluation) to enforce the boundary.
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

export function quoteDatabaseIdentifier(value: string): string {
  return `"${validateDatabaseSchemaIdentifier(value)}"`
}
