import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

function wordFromCodes(codes: number[]): string {
  return String.fromCharCode(...codes)
}

function patternFromCodes(parts: number[][], flags = 'i'): RegExp {
  const escaped = parts
    .map((part) =>
      wordFromCodes(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('')
  return new RegExp(escaped, flags)
}

function main(): void {
  assert.ok(existsSync('package.json'), 'package.json should exist')

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>
  }

  const scripts = packageJson.scripts ?? {}
  const command = scripts['staging:static-preflight'] ?? ''
  const source = readFileSync('scripts/committed_evidence_guard.test.ts', 'utf8')

  assert.ok(existsSync('docs/client/evidence/.gitkeep'), 'docs/client/evidence/.gitkeep should exist')
  assert.ok(scripts['evidence:create'], 'evidence:create should exist')
  assert.ok(scripts['evidence:validate'], 'evidence:validate should exist')
  assert.ok(scripts['staging:static-preflight'], 'staging:static-preflight should exist')
  assert.ok(scripts['toolchain:check'], 'toolchain:check should exist')

  assert.match(command, /pnpm evidence:validate/)
  assert.doesNotMatch(command, /evidence:create/)

  const blockedValuePatterns = [
    patternFromCodes([[112, 114, 105, 115, 109, 97], [32], [109, 105, 103, 114, 97, 116, 101]]),
    patternFromCodes([[112, 97, 121, 108, 111, 97, 100], [32], [109, 105, 103, 114, 97, 116, 101]]),
    patternFromCodes([[100, 98], [32], [112, 117, 115, 104]]),
    patternFromCodes([[102, 101, 116, 99, 104], [40]]),
    patternFromCodes([[97, 120, 105, 111, 115]], 'i'),
    patternFromCodes([[104, 116, 116, 112], [46], [114, 101, 113, 117, 101, 115, 116]]),
    patternFromCodes([[104, 116, 116, 112, 115], [46], [114, 101, 113, 117, 101, 115, 116]]),
    patternFromCodes([[46], [101, 110, 118]]),
    patternFromCodes([[68, 65, 84, 65, 66, 65, 83, 69], [95], [85, 82, 76]], 'i'),
  ]

  for (const value of Object.values(scripts)) {
    if (!/evidence:(create|validate|test)|staging:static-preflight|toolchain:check/.test(value)) continue
    for (const blockedPattern of blockedValuePatterns) {
      assert.doesNotMatch(value, blockedPattern)
    }
  }

  const evidenceFiles = readdirSync('docs/client/evidence').filter((file) => file.endsWith('.md'))
  if (evidenceFiles.length > 0) {
    assert.fail(
      `Draft/operator evidence must not be committed unless explicitly approved. Found: ${evidenceFiles.join(', ')}`,
    )
  }

  for (const blockedPattern of blockedValuePatterns) {
    assert.doesNotMatch(source, blockedPattern)
  }

  console.log('committed_evidence_guard.test.ts passed')
}

main()
