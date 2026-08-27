import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { previewMigrationInventory, previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'
import { PAYLOAD_MIGRATION_NAMES } from '../src/lib/payloadMigrationRegistry'
import { REGISTERED_PAYLOAD_MIGRATIONS } from './release/buildStagingMigrationStatus'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'src', 'migrations')
const INDEX_FILE = path.join(MIGRATIONS_DIR, 'index.ts')
const REGISTRY_MODULE_FILE = path.join(REPO_ROOT, 'src', 'lib', 'payloadMigrationRegistry.ts')
const RUNTIME_PREFLIGHT_FILE = path.join(REPO_ROOT, 'scripts', 'release', 'payload-migration-preflight.cjs')
const DOCKERFILE = path.join(REPO_ROOT, 'Dockerfile')
const READINESS_MATRIX = path.join(REPO_ROOT, 'docs', 'release', 'STAGING_OPERATIONAL_READINESS_MATRIX.md')

const failures: string[] = []
function test(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`PASS ${label}`)
  } catch (error) {
    failures.push(label)
    console.error(`FAIL ${label}`)
    console.error(error)
  }
}

const migrationDirectoryFiles = fs.readdirSync(MIGRATIONS_DIR)
const datedModules = migrationDirectoryFiles
  .filter((filename) => /^\d{8}_\d{6}.*\.ts$/.test(filename))
  .map((filename) => path.basename(filename, '.ts'))
  .sort()
const nonExecutableTypeScriptHelpers = migrationDirectoryFiles.filter((filename) =>
  filename.endsWith('.ts') && filename !== 'index.ts' && !/^\d{8}_\d{6}.*\.ts$/.test(filename)
)
const jsonSnapshots = migrationDirectoryFiles.filter((filename) => filename.endsWith('.json'))
const indexSource = fs.readFileSync(INDEX_FILE, 'utf8')
const registryModuleSource = fs.readFileSync(REGISTRY_MODULE_FILE, 'utf8')
const runtimePreflightSource = fs.readFileSync(RUNTIME_PREFLIGHT_FILE, 'utf8')
const dockerfileSource = fs.readFileSync(DOCKERFILE, 'utf8')
const runtimeNames = [...indexSource.matchAll(/^\s*'([^']+)'\s*:\s*migration_/gm)].map((match) => match[1])
const previewNames = previewMigrationInventoryNames()
const previewEntries = previewMigrationInventory()
const readinessMatrix = fs.readFileSync(READINESS_MATRIX, 'utf8')

console.log('\nPayload Migration Inventory Contract\n')

test('exactly one dated module exists for every canonical migration', () => {
  assert.equal(datedModules.length, PAYLOAD_MIGRATION_NAMES.length)
  assert.equal(datedModules.length, 51)
})

test('canonical registry is ordered, unique, and has the reviewed 51 names', () => {
  assert.match(registryModuleSource, /export const PAYLOAD_MIGRATION_NAMES\s*=\s*\[/)
  assert.equal(PAYLOAD_MIGRATION_NAMES.length, 51)
  assert.equal(new Set(PAYLOAD_MIGRATION_NAMES).size, PAYLOAD_MIGRATION_NAMES.length)
  assert.equal(PAYLOAD_MIGRATION_NAMES.at(-1), '20260826_150000_member_delete_relationship_safety')
})

test('every canonical name has one dated TypeScript module', () => {
  assert.deepEqual([...PAYLOAD_MIGRATION_NAMES].sort(), datedModules)
})

test('migrations directory contains no non-executable TypeScript helpers', () => {
  assert.deepEqual(nonExecutableTypeScriptHelpers, [])
  assert.equal(fs.existsSync(path.join(MIGRATIONS_DIR, 'migrationRegistry.ts')), false)
})

test('runtime Payload migration definitions exactly match the canonical order', () => {
  assert.deepEqual(runtimeNames, [...PAYLOAD_MIGRATION_NAMES])
  assert.match(indexSource, /PAYLOAD_MIGRATION_NAMES\.map\(\(name\)/)
  assert.equal((indexSource.match(/name:\s*['"]/g) ?? []).length, 0)
})

test('preview health inventory names exactly match the canonical order', () => {
  assert.deepEqual(previewNames, [...PAYLOAD_MIGRATION_NAMES])
})

test('preview metadata has one positional entry per canonical migration', () => {
  assert.equal(previewEntries.length, PAYLOAD_MIGRATION_NAMES.length)
  assert.deepEqual(previewEntries.map((entry) => entry.name), [...PAYLOAD_MIGRATION_NAMES])
  assert.deepEqual(previewEntries.map((entry) => entry.order), PAYLOAD_MIGRATION_NAMES.map((_, index) => index + 1))
})

test('migration-status registered names exactly match the canonical order', () => {
  assert.deepEqual([...REGISTERED_PAYLOAD_MIGRATIONS], [...PAYLOAD_MIGRATION_NAMES])
})

test('plain-Node runtime preflight does not maintain a second ordered migration-name list', () => {
  assert.doesNotMatch(runtimePreflightSource, /const REQUIRED_PAYLOAD_MIGRATIONS\s*=\s*\[/)
  assert.match(runtimePreflightSource, /src\/lib\/payloadMigrationRegistry\.ts/)
  assert.match(runtimePreflightSource, /loadCanonicalMigrationNames/)
  assert.match(dockerfileSource, /COPY --from=builder \/app\/src\/lib\/payloadMigrationRegistry\.ts \.\/src\/lib\/payloadMigrationRegistry\.ts/)
})

test('JSON files remain snapshots rather than migration modules', () => {
  assert.ok(jsonSnapshots.length > 0)
  assert.equal(datedModules.some((name) => name.endsWith('.json')), false)
})

test('documentation does not conflate registration inventory with applied state', () => {
  assert.equal(readinessMatrix.includes('34 Payload migration'), false)
  assert.equal(readinessMatrix.includes('28 applied'), false)
  assert.equal(readinessMatrix.includes('proves applied'), false)
})

console.log('')
if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} migration inventory contract assertion(s) failed`)
  process.exit(1)
}
console.log('PASS — all migration inventory contract assertions satisfied.')
