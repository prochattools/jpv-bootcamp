import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { RELEASE_TEST_MANIFEST } from './releaseTestManifest'

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function countPlaywrightSourceDeclarations(root: string): number {
  const absolute = path.join(process.cwd(), root)
  const entries = readdirSync(absolute)
  let count = 0
  for (const entry of entries) {
    const entryPath = path.join(absolute, entry)
    const stats = statSync(entryPath)
    if (stats.isDirectory()) {
      count += countPlaywrightSourceDeclarations(path.join(root, entry))
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
  const browserSourceDeclarations = countPlaywrightSourceDeclarations('e2e')
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
    `- Browser source-level declarations (static): \`${browserSourceDeclarations}\` (not equivalent to Playwright project-expanded collected runs)`,
    `- Last verified Playwright execution evidence: 188 collected; 148 passed; 40 skipped; four staging-only spec files not collected`,
    '',
    '## Repository-owned gates',
    '- Guarded pre-apply migration evidence: run `31215369413` at reviewed code checkpoint `9e068cc8b0a5ec9573732fee3a78bed9995787a6` returned `plan_ok`: 28 Payload migrations applied; `20260804_050000_member_account_action_reservations` solely missing; Prisma healthy; zero unexpected, duplicate, or malformed Payload migration evidence.',
    '- Final-SHA migration gate: a fresh guarded read-only pre-apply plan must return `plan_ok` at the eventual final CI-green SHA before migration 29 apply authorization.',
    '- Automated staging validation: passed for the exact deployed baseline SHA; the current candidate is not claimed as deployed.',
    '- Provider verification: documented, pending approved operator evidence',
    '- Formal staging sign-off: pending external action',
    '- Support schema migration state: covered by the healthy expected Prisma history and sole-missing-Payload result from run `31215369413`; live support-flow smoke remains pending after exact-SHA deployment.',
    '- Programme content approval: pending',
    '',
    '## False-claim guard',
    '- Migration 29 is not claimed as applied; apply requires separate explicit operator authorization.',
    '- No current-candidate staging deployment is claimed.',
    '- No provider verification is claimed as complete.',
    '- No formal staging acceptance is claimed while external sign-off is pending.',
    '- No production migration or deployment is claimed.',
    '- Launch-scope repository implementation is complete; migration 29 apply, exact-SHA staging deployment, smoke, and external acceptance remain pending.',
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
