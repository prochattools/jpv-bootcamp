const DEFAULT_PAYLOAD_SCHEMA = 'jpvbootcamp'
const SAFE_SCHEMA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

export type DatabaseConnectionConfig = {
  connectionString: string
  schema: string
  metadata: {
    configured: boolean
    protocol: string | null
    credentialsPresent: boolean
    schemaSource: 'override' | 'url' | 'default'
  }
}

export function validateDatabaseSchemaIdentifier(value: string): string {
  const schema = value.trim()
  if (!SAFE_SCHEMA_IDENTIFIER.test(schema)) {
    throw new Error('Database schema identifier is invalid')
  }
  return schema
}

export function resolveDatabaseConnectionConfig(
  rawUrl: string | undefined,
  schemaOverride: string | undefined,
): DatabaseConnectionConfig {
  const override = schemaOverride?.trim()
  let schema = DEFAULT_PAYLOAD_SCHEMA
  let schemaSource: DatabaseConnectionConfig['metadata']['schemaSource'] = 'default'
  let connectionString = rawUrl || ''
  let protocol: string | null = null
  let credentialsPresent = false

  if (rawUrl) {
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
  }

  if (override) {
    schema = validateDatabaseSchemaIdentifier(override)
    schemaSource = 'override'
  } else {
    schema = validateDatabaseSchemaIdentifier(schema)
  }

  return {
    connectionString,
    schema,
    metadata: {
      configured: Boolean(rawUrl),
      protocol,
      credentialsPresent,
      schemaSource,
    },
  }
}

export function quoteDatabaseIdentifier(value: string): string {
  return `"${validateDatabaseSchemaIdentifier(value)}"`
}
