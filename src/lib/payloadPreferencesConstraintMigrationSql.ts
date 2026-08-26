import { quotePgIdentifier } from './payloadMigrationSchema'

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const constraintName = 'payload_preferences_id_unique'

export function getPayloadPreferencesConstraintSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the preferences constraint repair')

  let schema: string | null
  try {
    schema = new URL(databaseUrl).searchParams.get('schema')
  } catch {
    throw new Error('Malformed DATABASE_URL')
  }

  if (!schema) throw new Error('DATABASE_URL must include an explicit schema parameter')
  if (!schemaIdentifierPattern.test(schema)) {
    throw new Error(`Invalid Payload migration schema: ${schema}`)
  }

  return schema
}

export function buildPayloadPreferencesConstraintUpSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getPayloadPreferencesConstraintSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const table = `${schema}."payload_preferences"`
  const constraint = quotePgIdentifier(constraintName)

  return `
DO $$
DECLARE
  null_count bigint;
  duplicate_count bigint;
  has_suitable_constraint boolean;
  sequence_name text;
BEGIN
  IF to_regclass('${schemaName}.payload_preferences') IS NULL THEN
    RAISE EXCEPTION 'Missing table %.payload_preferences', '${schemaName}';
  END IF;

  EXECUTE 'SELECT count(*) FROM ${table} WHERE id IS NULL' INTO null_count;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot repair %.payload_preferences: % null id values found', '${schemaName}', null_count;
  END IF;

  EXECUTE 'SELECT count(*) FROM (SELECT id FROM ${table} GROUP BY id HAVING count(*) > 1) duplicates'
    INTO duplicate_count;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot repair %.payload_preferences: % duplicate id values found', '${schemaName}', duplicate_count;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = '${schemaName}'
      AND t.relname = 'payload_preferences'
      AND c.contype IN ('p', 'u')
      AND pg_get_constraintdef(c.oid) ~ '^UNIQUE \\(id\\)$|^PRIMARY KEY \\(id\\)$'
  ) INTO has_suitable_constraint;

  IF NOT has_suitable_constraint THEN
    EXECUTE 'ALTER TABLE ${table} ADD CONSTRAINT ${constraint} UNIQUE (id)';
  END IF;

  SELECT pg_get_serial_sequence('${schemaName}.payload_preferences', 'id') INTO sequence_name;
  IF sequence_name IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L, GREATEST(COALESCE((SELECT max(id) FROM ${table}), 0), 1), COALESCE((SELECT max(id) FROM ${table}), 0) > 0)',
      sequence_name
    );
  END IF;
END
$$;
`
}

export function buildPayloadPreferencesConstraintDownSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schemaName = getPayloadPreferencesConstraintSchema(databaseUrl)
  const schema = quotePgIdentifier(schemaName)
  const constraint = quotePgIdentifier(constraintName)

  return `
ALTER TABLE IF EXISTS ${schema}."payload_preferences"
  DROP CONSTRAINT IF EXISTS ${constraint};
`
}
