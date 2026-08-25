import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'

import { loadAndVerifyLegacySourceManifest } from './legacySourceManifest'

const root = mkdtempSync(path.join(os.tmpdir(), 'jpv-source-manifest-'))
const sqlPath = path.join(root, 'source.sql')
const wxrPath = path.join(root, 'source.xml')
const manifestPath = path.join(root, 'manifest.json')
writeFileSync(sqlPath, 'sql-source')
writeFileSync(wxrPath, 'wxr-source')

const fingerprint = (value: string) => ({
  bytes: Buffer.byteLength(value),
  sha256: createHash('sha256').update(value).digest('hex'),
})

writeFileSync(manifestPath, JSON.stringify({
  manifestVersion: '1.0',
  snapshotDate: '2026-08-25',
  sources: { sql: fingerprint('sql-source'), wxr: fingerprint('wxr-source') },
  identity: { sourceMemberAccounts: 50, canonicalMembers: 49, active: 11, blocked: 38 },
  content: {},
}))

assert.equal(loadAndVerifyLegacySourceManifest({ manifestPath, sqlPath, wxrPath }).snapshotDate, '2026-08-25')
writeFileSync(sqlPath, 'changed-source')
assert.throws(
  () => loadAndVerifyLegacySourceManifest({ manifestPath, sqlPath, wxrPath }),
  /LEGACY_SOURCE_MANIFEST_MISMATCH sql/,
)

console.log('Legacy source manifest contract: PASS (2/2)')
