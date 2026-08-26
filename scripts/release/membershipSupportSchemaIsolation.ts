import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export type GitSnapshot = Readonly<{
  branch: string
  head: string
  statusLines: string[]
}>

export type MembershipSupportSchemaIsolationReport = Readonly<{
  ok: boolean
  errors: string[]
  output: string
}>

export const EXPECTED_BRANCH = 'feature/course-branding-and-preview'
export const PROTECTED_PATHS = ['src/payload-types.ts', 'docs/client/fixtures/']

const FORBIDDEN_OPERATIONS = [
  'payload migrate:create',
  'payload generate:types',
  'payload generate:importmap',
  'prisma migrate',
  'mcp:provision',
  'deploy',
]

function readGitSnapshot(): GitSnapshot {
  const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  const statusLines = execFileSync('git', ['status', '--short'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)

  return { branch, head, statusLines }
}

function classifyStatusLines(statusLines: string[]): { protectedDirty: string[]; otherDirty: string[] } {
  const protectedDirty: string[] = []
  const otherDirty: string[] = []

  for (const line of statusLines) {
    const path = line.slice(3).trim()
    const isProtected = PROTECTED_PATHS.some((protectedPath) => path === protectedPath || path.startsWith(`${protectedPath}/`))
    if (isProtected) protectedDirty.push(path)
    else otherDirty.push(path)
  }

  return { protectedDirty, otherDirty }
}

export function buildMembershipSupportSchemaIsolationReport(
  snapshot: GitSnapshot = readGitSnapshot(),
): MembershipSupportSchemaIsolationReport {
  const errors: string[] = []
  const { protectedDirty, otherDirty } = classifyStatusLines(snapshot.statusLines)

  if (snapshot.branch !== EXPECTED_BRANCH) {
    errors.push(`branch_mismatch:${snapshot.branch}`)
  }
  if (!snapshot.head.trim()) {
    errors.push('missing_head')
  }

  const protectedDiffCommands = PROTECTED_PATHS.map((protectedPath) => `git diff -- ${protectedPath}`)
  const isolatedWorktreePlan = [
    'git worktree add ../jpv-bootcamp-schema-worktree HEAD',
    'git -C ../jpv-bootcamp-schema-worktree status --short',
    'git -C ../jpv-bootcamp-schema-worktree diff --check',
    'git worktree remove ../jpv-bootcamp-schema-worktree --force',
  ]

  const cleanupChecks = [
    'Verify the original worktree still contains the protected dirty paths unchanged.',
    'Verify the sibling worktree was removed.',
    'Verify no migration or type generation commands were executed in the original worktree.',
  ]

  const prohibitedOperations = [...FORBIDDEN_OPERATIONS]
  const combinedPlan = [...protectedDiffCommands, ...isolatedWorktreePlan, ...cleanupChecks, ...prohibitedOperations].join('\n')
  for (const forbidden of FORBIDDEN_OPERATIONS) {
    if (combinedPlan.includes(forbidden)) continue
    errors.push(`missing_prohibited_operation:${forbidden}`)
  }

  const lines = [
    'MEMBERSHIP SUPPORT SCHEMA ISOLATION PLAN',
    `Branch: ${snapshot.branch}`,
    `Head: ${snapshot.head}`,
    `Protected paths: ${PROTECTED_PATHS.join(', ')}`,
    `Protected dirty paths: ${protectedDirty.length > 0 ? protectedDirty.join(', ') : 'none'}`,
    `Other dirty paths: ${otherDirty.length > 0 ? otherDirty.join(', ') : 'none'}`,
    '',
    'Preflight',
    `- verify branch === ${EXPECTED_BRANCH}`,
    '- capture protected diffs without editing them',
    '- keep the original worktree as the source of truth',
    '',
    'Protected diff capture',
    ...protectedDiffCommands.map((command) => `- ${command}`),
    '',
    'Isolated worktree plan',
    ...isolatedWorktreePlan.map((command) => `- ${command}`),
    '',
    'Abort and cleanup checks',
    ...cleanupChecks.map((check) => `- ${check}`),
    '',
    'Prohibited operations',
    ...prohibitedOperations.map((operation) => `- ${operation}`),
    '',
  ]

  return { ok: errors.length === 0, errors, output: `${lines.join('\n').trim()}\n` }
}

export function main(): void {
  process.stdout.write(buildMembershipSupportSchemaIsolationReport().output)
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main()
}
