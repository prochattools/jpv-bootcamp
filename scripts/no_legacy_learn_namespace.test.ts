import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCAN_ROOTS = [
  'src',
  'scripts',
  'e2e',
  'docs/ARCHITECTURE.md',
  'docs/PAYLOAD_INTEGRATION_PLAN.md',
  'docs/PREVIEW_RELEASE_READINESS.md',
  'docs/client/OPERATOR_HANDOFF_SUMMARY.md',
  'docs/client/README.md',
  'docs/client/ROADMAP_PROGRESS_STATUS.md',
  'docs/client/STATUS_UPDATE_PROCEDURE.md',
  'docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md',
] as const

const ALLOWED_PROSE = /\blearn(?:ing|ed|er|ers|s)?\b/i
const removedNamespace = `/${'learn'}`
const removedTree = `src/app/(frontend)/${'learn'}`
const excludedFiles = new Set([
  'scripts/no_legacy_learn_namespace.test.ts',
  'e2e/auth-portal-admin.spec.ts',
  'e2e/portal-courses-community.spec.ts',
  'e2e/fixtures/launchFixtures.ts',
  'scripts/portal_member_route_ownership.test.ts',
  'scripts/payload_member_auth_architecture.test.ts',
])
const FORBIDDEN_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'removed member route path', regex: new RegExp(`(^|[^A-Za-z])${removedNamespace}(?:/|\\b)`) },
  { label: 'removed member route tree path', regex: new RegExp(removedTree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) },
  { label: 'removed member import', regex: new RegExp(`from\\s+['"][^'"]*${'learn'}/`) },
  { label: 'removed member href', regex: new RegExp(`href=\\{?['"\`]${removedNamespace}(?:/|\\b)`) },
]

function listFiles(target: string): string[] {
  const absolute = path.join(ROOT, target)
  if (!existsSync(absolute)) return []
  const stats = statSync(absolute)
  if (stats.isFile()) return [absolute]

  const files: string[] = []
  for (const entry of readdirSync(absolute)) {
    files.push(...listFiles(path.join(target, entry)))
  }
  return files
}

function shouldScan(file: string): boolean {
  return /\.(ts|tsx|md|json|yml|yaml)$/.test(file)
}

function scanFile(file: string): void {
  const relative = path.relative(ROOT, file)
  if (excludedFiles.has(relative)) return
  const content = readFileSync(file, 'utf8')

  for (const { label, regex } of FORBIDDEN_PATTERNS) {
    assert.doesNotMatch(content, regex, `${relative} contains forbidden ${label}`)
  }

  if (relative.endsWith('.md')) {
    const lowered = content.toLowerCase()
    if (lowered.includes(removedNamespace)) {
      throw new Error(`${relative} contains forbidden removed-member-namespace markdown reference`)
    }
  }

  if (relative.endsWith('.md') && ALLOWED_PROSE.test(content) && !content.includes(removedNamespace)) {
    return
  }
}

function testLearnTreeDeleted(): void {
  assert.equal(existsSync(path.join(ROOT, removedTree)), false, `${removedTree} must be deleted`)
}

try {
  testLearnTreeDeleted()
  for (const root of SCAN_ROOTS) {
    for (const file of listFiles(root)) {
      if (!shouldScan(file)) continue
      scanFile(file)
    }
  }
  console.log('no_legacy_learn_namespace.test.ts passed')
} catch (error) {
  console.error(
    'no_legacy_learn_namespace.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
