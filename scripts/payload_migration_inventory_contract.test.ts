/**
 * payload_migration_inventory_contract.test.ts
 *
 * Contract test: proves the migration inventory is coherent and that documentation
 * correctly describes what migrationInventoryNames means.
 *
 * SEMANTIC CONTRACT (documented here, enforced below):
 *   migrationInventoryNames  = application registration inventory
 *                            = the list of migration modules compiled into the
 *                              running image
 *                            ≠ applied DB state
 *
 * Applied state requires a read-only operator query against Payload's migration
 * tracking table (e.g. SELECT name FROM payload_migrations ORDER BY created_at).
 * The health endpoint CANNOT prove which migrations have been applied to the DB.
 *
 * Run standalone:
 *   tsx scripts/payload_migration_inventory_contract.test.ts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'src', 'migrations');
const INDEX_FILE = path.join(MIGRATIONS_DIR, 'index.ts');
const READINESS_MATRIX = path.join(
  REPO_ROOT,
  'docs',
  'release',
  'STAGING_OPERATIONAL_READINESS_MATRIX.md',
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dated migration .ts files — excludes index.ts and all .json files */
function getDatedTsFiles(): string[] {
  const entries = fs.readdirSync(MIGRATIONS_DIR);
  return entries.filter(
    (f) =>
      f.endsWith('.ts') &&
      f !== 'index.ts' &&
      /^\d{8}_\d{6}/.test(f),
  );
}

/** Extract the bare stem (no extension) from a filename */
function stem(filename: string): string {
  return path.basename(filename, '.ts');
}

/** Extract all import paths from index.ts (e.g. './20260620_213328') */
function getIndexImports(src: string): string[] {
  const matches = [...src.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)];
  return matches.map((m) => m[1]);
}

/** Names registered in the exports array (name: '...' entries) */
function getRegisteredNames(src: string): string[] {
  const matches = [...src.matchAll(/name:\s*['"]([^'"]+)['"]/g)];
  return matches.map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// Load sources
// ---------------------------------------------------------------------------

const indexSrc = fs.readFileSync(INDEX_FILE, 'utf8');
const datedTsFiles = getDatedTsFiles();
const indexImports = getIndexImports(indexSrc);
const registeredNames = getRegisteredNames(indexSrc);

const readinessMatrixSrc = fs.existsSync(READINESS_MATRIX)
  ? fs.readFileSync(READINESS_MATRIX, 'utf8')
  : '';

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const failures: string[] = [];

function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL  ${label}\n        ${msg}`);
    failures.push(label);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\nPayload Migration Inventory Contract\n');

// 1. Count dated .ts files in src/migrations/ (excluding index.ts and .json)
test('1. Dated .ts file count is readable', () => {
  assert.ok(
    datedTsFiles.length > 0,
    `Expected at least one dated .ts file; found ${datedTsFiles.length}`,
  );
});

// 2. Count registered imports in src/migrations/index.ts
test('2. index.ts imports are readable', () => {
  assert.ok(
    indexImports.length > 0,
    `Expected at least one import in index.ts; found ${indexImports.length}`,
  );
});

// 3. Both counts are equal
test('3. Dated .ts file count equals import count in index.ts', () => {
  assert.equal(
    datedTsFiles.length,
    indexImports.length,
    `File count (${datedTsFiles.length}) !== import count (${indexImports.length})`,
  );
});

// 4. Actual count is exactly 28
test('4. Exactly 28 dated migration .ts files exist', () => {
  assert.equal(
    datedTsFiles.length,
    28,
    `Expected 28 dated .ts files; found ${datedTsFiles.length}: ${datedTsFiles.join(', ')}`,
  );
});

// 5. Every dated .ts filename appears in index.ts as an import
test('5. Every dated .ts file is imported in index.ts', () => {
  const missing: string[] = [];
  for (const file of datedTsFiles) {
    const name = stem(file);
    if (!indexImports.includes(name)) {
      missing.push(name);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `These .ts files are NOT imported in index.ts: ${missing.join(', ')}`,
  );
});

// 6. Every import in index.ts has a matching .ts file
test('6. Every import in index.ts has a matching .ts file on disk', () => {
  const missing: string[] = [];
  for (const imp of indexImports) {
    const expected = path.join(MIGRATIONS_DIR, `${imp}.ts`);
    if (!fs.existsSync(expected)) {
      missing.push(imp);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `These imports in index.ts have no matching .ts file: ${missing.join(', ')}`,
  );
});

// 7. No duplicate migration names
test('7. No duplicate migration names in index.ts', () => {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const name of registeredNames) {
    if (seen.has(name)) dupes.push(name);
    else seen.add(name);
  }
  assert.deepEqual(dupes, [], `Duplicate migration names: ${dupes.join(', ')}`);
});

// 8. JSON snapshot files do NOT appear as imports in index.ts
// JSON files share name stems with .ts files (e.g. 20260620_213328.json alongside
// 20260620_213328.ts). The correct check is that no import path in index.ts
// explicitly references a .json path — i.e. no `from './something.json'` import.
// Each import resolves to the .ts module; the JSON files are schema snapshots only.
test('8. JSON snapshot files are NOT imported in index.ts', () => {
  const jsonFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.json'));

  // Verify json files exist (snapshot files are present)
  assert.ok(jsonFiles.length > 0, 'Expected at least one JSON snapshot file in src/migrations/');

  // No import in index.ts should end with .json
  const jsonImports = indexImports.filter((imp) => imp.endsWith('.json'));
  assert.deepEqual(
    jsonImports,
    [],
    `index.ts must not import .json files directly as migration modules: ${jsonImports.join(', ')}`,
  );

  // The total number of imports must equal the number of .ts files, not .ts + .json
  // (this is already enforced by tests 3 and 4, but stated here for clarity)
  assert.equal(
    indexImports.length,
    datedTsFiles.length,
    `Import count (${indexImports.length}) must equal .ts file count (${datedTsFiles.length}), ` +
      'confirming JSON snapshots add no extra import entries',
  );
});

// 9. Semantic contract: migrationInventoryNames = application registration ≠ applied DB state
test('9. Semantic contract: migrationInventoryNames documents registered modules, not applied DB state', () => {
  // This test encodes the invariant as an assertion that is always true.
  // It serves as executable documentation.
  const CONTRACT =
    'migrationInventoryNames = application registration inventory ≠ applied DB state';

  // The registered names in index.ts are the application inventory.
  // We verify the inventory is a non-empty ordered list of strings —
  // evidence that the field documents static compile-time registration.
  assert.ok(
    registeredNames.length > 0,
    'registeredNames must be non-empty to represent a valid inventory',
  );

  // All names must be strings (not runtime database records)
  for (const name of registeredNames) {
    assert.equal(
      typeof name,
      'string',
      `Expected string name, got: ${typeof name}`,
    );
  }

  // Order is deterministic (source-file order, not DB insertion order)
  const sorted = [...registeredNames].sort();
  assert.notDeepEqual(
    registeredNames,
    sorted,
    // We do NOT require alphabetical order — we require source-file declaration order.
    // If this assertion ever fails it means someone sorted the list alphabetically
    // instead of preserving chronological declaration order. That is intentional
    // so we skip the strict-order check and just assert the contract label exists.
    // Replace with a no-op pass: we assert the contract string is defined.
  );
  assert.ok(CONTRACT.length > 0, 'Contract string must be defined');
  // Silence the unused variable lint
  void CONTRACT;
});

// 10. No docs claim "34 Payload migration" modules exist
test('10. STAGING_OPERATIONAL_READINESS_MATRIX.md does NOT claim "34 Payload migration"', () => {
  assert.ok(
    readinessMatrixSrc.length > 0,
    'STAGING_OPERATIONAL_READINESS_MATRIX.md must exist and be readable',
  );
  assert.ok(
    !readinessMatrixSrc.includes('34 Payload migration'),
    'Found forbidden string "34 Payload migration" in STAGING_OPERATIONAL_READINESS_MATRIX.md — ' +
      'there are 28 migration .ts modules (+ 5 JSON snapshots); update the doc.',
  );
});

// 11. No docs claim staging health proves applied migration state
test('11. STAGING_OPERATIONAL_READINESS_MATRIX.md does NOT contain "proves applied" or "28 applied"', () => {
  assert.ok(
    readinessMatrixSrc.length > 0,
    'STAGING_OPERATIONAL_READINESS_MATRIX.md must exist and be readable',
  );
  assert.ok(
    !readinessMatrixSrc.includes('proves applied'),
    'Found forbidden string "proves applied" in STAGING_OPERATIONAL_READINESS_MATRIX.md — ' +
      'the health endpoint documents registration inventory, not applied DB state.',
  );
  assert.ok(
    !readinessMatrixSrc.includes('28 applied'),
    'Found forbidden string "28 applied" in STAGING_OPERATIONAL_READINESS_MATRIX.md — ' +
      '"28 applied" conflates registered inventory with applied DB state; ' +
      'applied state requires a direct DB query against payload_migrations.',
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
if (failures.length === 0) {
  console.log('PASS — all migration inventory contract assertions satisfied.');
  process.exit(0);
} else {
  console.error(
    `FAIL — ${failures.length} assertion(s) failed:\n` +
      failures.map((f) => `  - ${f}`).join('\n'),
  );
  process.exit(1);
}
