import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(import.meta.dirname, '../src/components/portal/PortalRoomsAdmin.tsx'), 'utf8')

// Regression: production Rooms admin hydration mismatch from runtime-local date formatting.
// Found by /qa on 2026-08-30
// Report: .gstack/qa-reports/qa-report-jpvbootcamp-com-2026-08-30.md
assert.match(source, /timeZone: 'UTC'/)

console.log('rooms-hydration-contract.test.ts passed')
