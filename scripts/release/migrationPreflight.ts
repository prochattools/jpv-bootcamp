/**
 * Migration-generation preflight: verify branch state, capture protected files,
 * plan isolated worktrees, validate clean migration environment.
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import * as crypto from 'crypto'

interface PreflightState {
  branch: string
  currentHead: string
  expectedHead: string
  headMatches: boolean
  protectedChecksums: Record<string, string>
  protectedDiffs: Record<string, string>
  isolatedWorktreePath: string | null
  migrationEnvironmentClean: boolean
  migrationDirStatus: Record<string, string>
  migrationGenerationCommand: string
  expectedMigrationOutputPaths: string[]
  worktreeCleanup: boolean
  timestamp: string
  evidence: string
}

const repoRoot = resolve(__dirname, '../../')
const protectedPaths = ['src/payload-types.ts', 'docs/client/fixtures/']
const migrationDir = 'src/migrations'
const expectedHead = '55b6895'
const migrationGenerationCommand = 'pnpm payload migration:create --name membership_support'
const expectedMigrationOutputPattern = 'src/migrations/*.ts'

function getCurrentBranch(): string {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot }).toString().trim()
}

function getCurrentHead(): string {
  return execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim()
}

function getFileChecksum(filePath: string): string {
  try {
    const fullPath = resolve(repoRoot, filePath)
    if (!existsSync(fullPath)) return 'NOT_EXISTS'
    const content = readFileSync(fullPath, 'utf8')
    return crypto.createHash('sha256').update(content).digest('hex')
  } catch {
    return 'ERROR'
  }
}

function getFileDiff(filePath: string): string {
  try {
    return execSync(`git diff -- ${filePath}`, { cwd: repoRoot, encoding: 'utf8' })
  } catch {
    return 'ERROR'
  }
}

function checkMigrationDirectoryClean(): boolean {
  try {
    const status = execSync(`git status --short -- ${migrationDir}`, { cwd: repoRoot, encoding: 'utf8' })
    return status.trim() === ''
  } catch {
    return false
  }
}

function getMigrationDirStatus(): Record<string, string> {
  try {
    const status = execSync(`git status --short -- ${migrationDir}`, { cwd: repoRoot, encoding: 'utf8' })
    const lines = status.trim().split('\n').filter(l => l)
    const result: Record<string, string> = {}
    for (const line of lines) {
      const [indicator, ...pathParts] = line.split(' ')
      result[pathParts.join(' ').trim()] = indicator
    }
    return result
  } catch {
    return {}
  }
}

function planIsolatedWorktree(): string {
  // Do not create worktree here; only calculate the path and prepare the plan
  const tmpDir = mkdtempSync(join(tmpdir(), 'jpv-bootcamp-migration-'))
  rmSync(tmpDir, { recursive: true, force: true }) // Clean up immediately; we just want the path name
  return tmpDir
}

async function runPreflight(): Promise<PreflightState> {
  const branch = getCurrentBranch()
  const currentHead = getCurrentHead()
  const timestamp = new Date().toISOString()

  if (branch !== 'feature/course-branding-and-preview') {
    throw new Error(`Wrong branch: ${branch}. Expected: feature/course-branding-and-preview`)
  }

  if (currentHead !== expectedHead && !currentHead.startsWith(expectedHead)) {
    throw new Error(`Unexpected HEAD: ${currentHead}. Expected: ${expectedHead}`)
  }

  const protectedChecksums: Record<string, string> = {}
  const protectedDiffs: Record<string, string> = {}

  for (const path of protectedPaths) {
    protectedChecksums[path] = getFileChecksum(path)
    protectedDiffs[path] = getFileDiff(path)
  }

  const migrationDirStatus = getMigrationDirStatus()
  const migrationEnvironmentClean = checkMigrationDirectoryClean()

  if (!migrationEnvironmentClean) {
    throw new Error(`Migration directory is not clean: ${JSON.stringify(migrationDirStatus)}`)
  }

  // Check for staged protected paths
  const stagedFiles = execSync('git diff --cached --name-only', { cwd: repoRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(l => l)
  for (const staged of stagedFiles) {
    if (protectedPaths.includes(staged)) {
      throw new Error(`Protected path is staged: ${staged}. Unstage before proceeding.`)
    }
  }

  const isolatedWorktreePath = planIsolatedWorktree()

  const evidence: PreflightState = {
    branch,
    currentHead,
    expectedHead,
    headMatches: currentHead === expectedHead,
    protectedChecksums,
    protectedDiffs,
    isolatedWorktreePath,
    migrationEnvironmentClean,
    migrationDirStatus,
    migrationGenerationCommand,
    expectedMigrationOutputPaths: [expectedMigrationOutputPattern],
    worktreeCleanup: false,
    timestamp,
    evidence: ''
  }

  return evidence
}

function generateMarkdownEvidence(state: PreflightState): string {
  let md = `# Migration Preflight Evidence\n\n`
  md += `**Timestamp**: ${state.timestamp}\n`
  md += `**Branch**: ${state.branch}\n`
  md += `**Current HEAD**: ${state.currentHead}\n`
  md += `**Expected HEAD**: ${state.expectedHead}\n`
  md += `**HEAD Matches**: ${state.headMatches ? '✓' : '✗'}\n\n`

  md += `## Protected File Checksums\n\n`
  for (const [path, checksum] of Object.entries(state.protectedChecksums)) {
    md += `- \`${path}\`: \`${checksum}\`\n`
  }

  md += `\n## Migration Environment Status\n\n`
  md += `**Clean**: ${state.migrationEnvironmentClean ? '✓' : '✗'}\n`
  md += `**Directory Status**: ${JSON.stringify(state.migrationDirStatus, null, 2)}\n\n`

  md += `## Planned Isolation\n\n`
  md += `**Isolated Worktree**: ${state.isolatedWorktreePath}\n`
  md += `**Migration Generation Command**: \`${state.migrationGenerationCommand}\`\n`
  md += `**Expected Output Paths**: ${state.expectedMigrationOutputPaths.join(', ')}\n\n`

  md += `## Next Steps\n\n`
  md += `1. Approve this preflight evidence.\n`
  md += `2. Create isolated worktree: \`git worktree add ${state.isolatedWorktreePath} ${state.currentHead}\`\n`
  md += `3. Verify original worktree unchanged: \`git status\`\n`
  md += `4. In isolated worktree, run: \`${state.migrationGenerationCommand}\`\n`
  md += `5. Verify output matches expected paths and no unrelated changes exist.\n`
  md += `6. Return to original worktree: \`git worktree remove ${state.isolatedWorktreePath}\`\n\n`

  return md
}

async function main() {
  try {
    const state = await runPreflight()
    const markdown = generateMarkdownEvidence(state)

    console.log(markdown)
    console.log('\n## JSON Evidence\n')
    console.log(JSON.stringify(state, null, 2))

    writeFileSync(resolve(repoRoot, 'docs/release/migration-preflight-evidence.json'), JSON.stringify(state, null, 2))
    writeFileSync(resolve(repoRoot, 'docs/release/migration-preflight-evidence.md'), markdown)

    process.exit(0)
  } catch (error) {
    console.error('Preflight failed:', error)
    process.exit(1)
  }
}

main()
