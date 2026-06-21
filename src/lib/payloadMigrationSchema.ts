const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

export function getPayloadMigrationSchema(): string {
  let schema: string | null = null

  try {
    const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null
    schema = url?.searchParams.get('schema') ?? null
  } catch {
    schema = null
  }

  const resolved = schema || process.env.APP_SLUG || 'jpvbootcamp'

  if (!schemaIdentifierPattern.test(resolved)) {
    throw new Error(`Invalid Payload migration schema: ${resolved}`)
  }

  return resolved
}

export function quotePgIdentifier(value: string): string {
  if (!schemaIdentifierPattern.test(value)) {
    throw new Error(`Invalid PostgreSQL identifier: ${value}`)
  }

  return `"${value.replace(/"/g, '""')}"`
}

export function getPayloadMigrationSchemaSqlPrefix(): string {
  return quotePgIdentifier(getPayloadMigrationSchema())
}

