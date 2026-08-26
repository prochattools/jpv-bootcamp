import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/api/health/deployment/route.ts', 'utf8')

assert.match(source, /previewMigrationInventoryNames\(\)/)
assert.match(source, /rootReexportsAdminImportMap/)
assert.match(source, /adminHasBrandingKeys/)
assert.match(source, /publicLogoExists/)
assert.doesNotMatch(source, /password=|cookie=|postgres:\/\//i)

console.log('payload_deployment_health.test.ts passed')
