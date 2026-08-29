import { quotePgIdentifier } from './payloadMigrationSchema'
import { REQUIRED_STAGING_SCHEMA } from './databaseConnectionConfig'

const requiredSchema = REQUIRED_STAGING_SCHEMA
const tableName = 'payload_preferences'

export type PayloadPreferencesDuplicateIdRepairDryRun = {
  schema: string
  table: string
  totalRowCount: number
  duplicateGroupCount: number
  duplicateRowCount: number
  nullIdCount: number
  currentMaxId: number
  plannedReassignmentCount: number
  safeStatus: 'dry_run_ready' | 'blocked'
}

function parseSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL is malformed')
  }

  const schema = parsed.searchParams.get('schema')
  if (schema !== requiredSchema) {
    throw new Error(`Refusing repair: schema must be exactly ${requiredSchema}`)
  }

  return schema
}

export function getPayloadPreferencesDuplicateIdRepairSchema(databaseUrl = process.env.DATABASE_URL): string {
  return parseSchema(databaseUrl)
}

export function buildPayloadPreferencesDuplicateIdRepairDryRunSql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schema = getPayloadPreferencesDuplicateIdRepairSchema(databaseUrl)
  const schemaIdentifier = quotePgIdentifier(schema)
  const table = `${schemaIdentifier}."${tableName}"`

  return `
WITH preference_rows AS (
  SELECT id, created_at, ctid
  FROM ${table}
),
duplicate_groups AS (
  SELECT id, count(*)::bigint AS row_count
  FROM preference_rows
  GROUP BY id
  HAVING count(*) > 1
),
duplicate_rows AS (
  SELECT count(*)::bigint AS row_count
  FROM preference_rows
  WHERE id IN (SELECT id FROM duplicate_groups)
),
null_rows AS (
  SELECT count(*)::bigint AS row_count
  FROM preference_rows
  WHERE id IS NULL
),
max_id AS (
  SELECT COALESCE(max(id), 0)::bigint AS value
  FROM preference_rows
)
SELECT
  '${schema}' AS schema,
  '${tableName}' AS table,
  (SELECT count(*)::bigint FROM preference_rows) AS total_row_count,
  (SELECT count(*)::bigint FROM duplicate_groups) AS duplicate_group_count,
  (SELECT row_count FROM duplicate_rows) AS duplicate_row_count,
  (SELECT row_count FROM null_rows) AS null_id_count,
  (SELECT value FROM max_id) AS current_max_id,
  GREATEST((SELECT row_count FROM duplicate_rows) - (SELECT count(*)::bigint FROM duplicate_groups), 0) AS planned_reassignment_count,
  CASE
    WHEN (SELECT row_count FROM null_rows) = 0
     AND (SELECT count(*)::bigint FROM duplicate_groups) > 0
    THEN 'dry_run_ready'
    ELSE 'blocked'
  END AS safe_status;
`
}

export function buildPayloadPreferencesDuplicateIdRepairApplySql(
  databaseUrl = process.env.DATABASE_URL,
): string {
  const schema = getPayloadPreferencesDuplicateIdRepairSchema(databaseUrl)
  const schemaIdentifier = quotePgIdentifier(schema)
  const table = `${schemaIdentifier}."${tableName}"`

  return `
DO $$
DECLARE
  row_count_before bigint;
  row_count_after bigint;
  null_count bigint;
  duplicate_group_count bigint;
  duplicate_row_count bigint;
  current_max_id bigint;
  planned_reassignment_count bigint;
  next_id bigint;
BEGIN
  SELECT count(*) INTO row_count_before FROM ${table};
  SELECT count(*) INTO null_count FROM ${table} WHERE id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Null ids are not allowed for repair';
  END IF;

  SELECT count(*) INTO duplicate_group_count
  FROM (
    SELECT id
    FROM ${table}
    GROUP BY id
    HAVING count(*) > 1
  ) duplicate_groups;

  SELECT count(*) INTO duplicate_row_count
  FROM ${table}
  WHERE id IN (
    SELECT id
    FROM ${table}
    GROUP BY id
    HAVING count(*) > 1
  );

  IF duplicate_group_count = 0 THEN
    RAISE EXCEPTION 'No duplicate ids found for repair';
  END IF;

  SELECT COALESCE(max(id), 0) INTO current_max_id FROM ${table};
  planned_reassignment_count := GREATEST(duplicate_row_count - duplicate_group_count, 0);
  next_id := current_max_id + 1;

  WITH ranked AS (
    SELECT ctid, id,
      row_number() OVER (
        PARTITION BY id
        ORDER BY created_at ASC NULLS LAST, ctid ASC
      ) AS rank_in_group
    FROM ${table}
  ),
  reassigned AS (
    SELECT ctid, row_number() OVER (ORDER BY id, ctid) AS sequence
    FROM ranked
    WHERE rank_in_group > 1
  )
  UPDATE ${table} target
  SET id = next_id + reassigned.sequence - 1
  FROM reassigned
  WHERE target.ctid = reassigned.ctid;

  SELECT count(*) INTO row_count_after FROM ${table};
  IF row_count_after <> row_count_before THEN
    RAISE EXCEPTION 'Repair changed row count';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM ${table}
    GROUP BY id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate ids remain after repair';
  END IF;

  EXECUTE format('SELECT setval(%L, (SELECT COALESCE(max(id), 0) FROM %s), true)', pg_get_serial_sequence('${schema}.payload_preferences', 'id'), '${table}');
END
$$;
`
}
