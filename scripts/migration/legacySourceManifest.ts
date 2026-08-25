import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'

import type { SnapshotExpectations, SourceContentExpectations } from './legacySourceDryRun'

type SourceFingerprint = {
  sha256: string
  bytes: number
}

export type LegacySourceManifest = {
  manifestVersion: '1.0'
  snapshotDate: string
  sources: {
    sql: SourceFingerprint
    wxr: SourceFingerprint
  }
  identity: SnapshotExpectations
  content: SourceContentExpectations
}

function assertFingerprint(label: 'sql' | 'wxr', filePath: string, expected: SourceFingerprint): void {
  const bytes = statSync(filePath).size
  const sha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex')
  if (bytes !== expected.bytes || sha256 !== expected.sha256) {
    throw new Error(
      `LEGACY_SOURCE_MANIFEST_MISMATCH ${label} expectedBytes=${expected.bytes} actualBytes=${bytes} `
      + `expectedSha256=${expected.sha256} actualSha256=${sha256}`,
    )
  }
}

export function loadAndVerifyLegacySourceManifest(params: {
  manifestPath: string
  sqlPath: string
  wxrPath: string
}): LegacySourceManifest {
  const manifest = JSON.parse(readFileSync(params.manifestPath, 'utf8')) as LegacySourceManifest
  if (manifest.manifestVersion !== '1.0' || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.snapshotDate)) {
    throw new Error('LEGACY_SOURCE_MANIFEST_INVALID unsupported manifest version or snapshot date')
  }
  assertFingerprint('sql', params.sqlPath, manifest.sources.sql)
  assertFingerprint('wxr', params.wxrPath, manifest.sources.wxr)
  return manifest
}
