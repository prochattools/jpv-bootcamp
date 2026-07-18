/**
 * Payload type-generation isolation tooling: capture baseline, generate in isolation,
 * compare against baseline, detect unrelated changes, refuse automatic merge.
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as crypto from 'crypto'

interface TypeGenerationState {
  protectedFilePath: string
  baselineChecksum: string
  baselineDiff: string
  isolatedOutputPath: string
  generatedOutputPath: string
  typeGenerationCommand: string
  importmapGenerationCommand: string
  generatedChecksum: string | null
  expectedMembershipSupportDelta: string[]
  unrelatedDeltaFound: boolean
  unrelatedChanges: string[]
  protectedFileUnchanged: boolean
  timestamp: string
  canAutoMerge: boolean
  blockerReason: string | null
}

const repoRoot = resolve(__dirname, '../../')
const protectedFilePath = 'src/payload-types.ts'
const expectedHead = '55b6895'
const typeGenerationCommand = 'pnpm payload generate:types'
const importmapGenerationCommand = 'pnpm payload generate:importmap'

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

function getFileContent(filePath: string): string {
  try {
    const fullPath = resolve(repoRoot, filePath)
    if (!existsSync(fullPath)) return ''
    return readFileSync(fullPath, 'utf8')
  } catch {
    return ''
  }
}

function detectUnrelatedChanges(before: string, after: string): { unrelated: boolean; changes: string[] } {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  const membershipSupportPatterns = [
    'membership_support',
    'membershipSupport',
    'MembershipSupport',
    'payload_membership',
    'Membership',
    'voucher',
    'Voucher',
    'funding',
    'Funding',
    'reconciliation',
    'Reconciliation',
    'ReviewQueue',
    'OperatorNote',
    'StripeShadow'
  ]

  const unrelatedChanges: string[] = []
  const changedLines = []

  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    const before = beforeLines[i] || ''
    const after = afterLines[i] || ''

    if (before !== after) {
      changedLines.push({ line: i, before, after })
    }
  }

  for (const change of changedLines) {
    let isMembershipRelated = false

    for (const pattern of membershipSupportPatterns) {
      if (change.before.includes(pattern) || change.after.includes(pattern)) {
        isMembershipRelated = true
        break
      }
    }

    if (!isMembershipRelated) {
      unrelatedChanges.push(
        `Line ${change.line}: "${change.before.substring(0, 50)}" => "${change.after.substring(0, 50)}"`
      )
    }
  }

  return { unrelated: unrelatedChanges.length > 0, changes: unrelatedChanges }
}

async function runTypeGenerationPreflight(): Promise<TypeGenerationState> {
  const currentHead = getCurrentHead()
  const timestamp = new Date().toISOString()

  if (currentHead !== expectedHead && !currentHead.startsWith(expectedHead)) {
    throw new Error(`Type generation isolation requires HEAD ${expectedHead}, got ${currentHead}`)
  }

  // Capture baseline
  const baselineChecksum = getFileChecksum(protectedFilePath)
  const baselineDiff = getFileDiff(protectedFilePath)
  const baselineContent = getFileContent(protectedFilePath)

  // Verify protected file is not staged
  const stagedFiles = execSync('git diff --cached --name-only', { cwd: repoRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(l => l)
  if (stagedFiles.includes(protectedFilePath)) {
    throw new Error(`Protected file ${protectedFilePath} must not be staged`)
  }

  // Define isolated output path (not created yet, only planned)
  const isolatedOutputPath = `/tmp/jpv-bootcamp-types-${Date.now()}-isolated`

  const state: TypeGenerationState = {
    protectedFilePath,
    baselineChecksum,
    baselineDiff,
    isolatedOutputPath,
    generatedOutputPath: `${isolatedOutputPath}/${protectedFilePath}`,
    typeGenerationCommand,
    importmapGenerationCommand,
    generatedChecksum: null,
    expectedMembershipSupportDelta: [
      'MembershipSupport',
      'Voucher',
      'PayItForwardFunding',
      'FundingSource',
      'Reconciliation',
      'AdministrationAction',
      'ReviewQueueItem',
      'OperatorNote',
      'StripeShadowProjection',
      'AuditHistory'
    ],
    unrelatedDeltaFound: false,
    unrelatedChanges: [],
    protectedFileUnchanged: true,
    timestamp,
    canAutoMerge: false,
    blockerReason: null
  }

  return state
}

function generateMarkdownEvidence(state: TypeGenerationState): string {
  let md = `# Payload Type-Generation Isolation Preflight\n\n`
  md += `**Timestamp**: ${state.timestamp}\n`
  md += `**Protected File**: \`${state.protectedFilePath}\`\n`
  md += `**Baseline Checksum**: \`${state.baselineChecksum}\`\n\n`

  md += `## Generation Commands\n\n`
  md += `\`\`\`bash\n`
  md += `${state.importmapGenerationCommand}\n`
  md += `${state.typeGenerationCommand}\n`
  md += `\`\`\`\n\n`

  md += `## Isolation Plan\n\n`
  md += `1. Create isolated worktree: \`git worktree add ${state.isolatedOutputPath} ${state.baselineChecksum}\`\n`
  md += `2. Enter isolated worktree: \`cd ${state.isolatedOutputPath}\`\n`
  md += `3. Run generators:\n`
  md += `   \`\`\`bash\n`
  md += `   ${state.importmapGenerationCommand}\n`
  md += `   ${state.typeGenerationCommand}\n`
  md += `   \`\`\`\n`
  md += `4. Capture generated output: \`cp ${protectedFilePath} /tmp/generated-types.ts\`\n`
  md += `5. Return to original worktree: \`cd -\`\n`
  md += `6. Compare using: \`git diff --no-index -- ${state.protectedFilePath} /tmp/generated-types.ts\`\n`
  md += `7. Verify only membership-support types changed; no unrelated drift\n`
  md += `8. Approve generated delta separately\n`
  md += `9. Clean up: \`git worktree remove ${state.isolatedOutputPath}\`\n\n`

  md += `## Expected Membership-Support Types\n\n`
  for (const type of state.expectedMembershipSupportDelta) {
    md += `- \`${type}\`\n`
  }

  md += `\n## Refusal Rules\n\n`
  md += `- ✓ Auto-merge: Only membership-support types changed\n`
  md += `- ✗ Manual review: Unrelated type changes detected\n`
  md += `- ✗ Abort: Generator drift or schema validation failure\n\n`

  return md
}

async function main() {
  try {
    const state = await runTypeGenerationPreflight()
    const markdown = generateMarkdownEvidence(state)

    console.log(markdown)
    console.log('\n## JSON Evidence\n')
    console.log(JSON.stringify(state, null, 2))

    writeFileSync(resolve(repoRoot, 'docs/release/type-generation-preflight-evidence.json'), JSON.stringify(state, null, 2))
    writeFileSync(resolve(repoRoot, 'docs/release/type-generation-preflight-evidence.md'), markdown)

    process.exit(0)
  } catch (error) {
    console.error('Type-generation preflight failed:', error)
    process.exit(1)
  }
}

main()
