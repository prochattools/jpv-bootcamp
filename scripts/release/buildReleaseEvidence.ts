import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { RELEASE_TEST_MANIFEST } from './releaseTestManifest'

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function countPlaywrightTests(root: string): number {
  const absolute = path.join(process.cwd(), root)
  const entries = readdirSync(absolute)
  let count = 0
  for (const entry of entries) {
    const entryPath = path.join(absolute, entry)
    const stats = statSync(entryPath)
    if (stats.isDirectory()) {
      count += countPlaywrightTests(path.join(root, entry))
      continue
    }
    if (!entry.endsWith('.spec.ts')) continue
    const source = read(path.join(root, entry))
    count += (source.match(/\btest\s*\(/g) ?? []).length
  }
  return count
}

function extractStatus(source: string, pattern: RegExp, fallback: string): string {
  const match = source.match(pattern)
  return match?.[1]?.trim() ?? fallback
}

export function buildReleaseEvidenceMarkdown(): string {
  const previewReadiness = read('docs/PREVIEW_RELEASE_READINESS.md')
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  const packageJson = JSON.parse(read('package.json')) as { packageManager?: string }
  const releaseCount = RELEASE_TEST_MANIFEST.length
  const browserCount = countPlaywrightTests('e2e')
  const readinessOutcome = extractStatus(
    previewReadiness,
    /\*\*Outcome:\*\*\s*`([^`]+)`/,
    'NOT READY FOR CONTROLLED STAGING RELEASE PROCESS',
  )

  const lines = [
    '# Release Evidence Summary',
    '',
    '## Identity',
    `- Branch: \`${branch}\``,
    `- Commit: \`${head}\``,
    `- Repository readiness outcome: \`${readinessOutcome}\``,
    '',
    '## Local evidence snapshot',
    `- Node runtime: \`${process.versions.node}\``,
    `- Pinned package manager: \`${packageJson.packageManager ?? 'unknown'}\``,
    `- Release manifest count: \`${releaseCount}\``,
    `- Browser test count: \`${browserCount}\``,
    '',
    '## Repository-owned gates',
    '- Migration preflight: documented, read-only, pending operator execution',
    '- Staging smoke plan: documented, plan-only, pending operator execution',
    '- Provider verification: documented, pending operator execution',
    '- Go/No-Go checklist: present, default state remains `NO-GO`',
    '- Support migration: unapplied',
    '- Programme content approval: pending',
    '',
    '## False-claim guard',
    '- No migration is claimed as applied.',
    '- No provider verification is claimed as complete.',
    '- No staging smoke is claimed as passed.',
    '- No production-live status is claimed.',
    '',
    '## Next operator-owned evidence',
    '- approved migration window and backup reference',
    '- provider/email verification evidence',
    '- staging smoke evidence',
    '- final go/no-go approval evidence',
    '',
  ]

  return lines.join('\n')
}

process.stdout.write(buildReleaseEvidenceMarkdown())
