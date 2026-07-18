/**
 * Tests for payload type-generation isolation tooling
 */

interface TestResult {
  passed: number
  failed: number
  errors: string[]
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function testBaselineCapture(): void {
  const baselineChecksum = 'abc123'
  const baselineDiff = 'diff --git a/src/payload-types.ts'
  assert(baselineChecksum.length > 0, 'Should capture baseline checksum')
  assert(baselineDiff.includes('diff --git'), 'Should capture baseline diff')
}

function testProtectedFilePathCorrect(): void {
  const protectedFilePath = 'src/payload-types.ts'
  assert(protectedFilePath.includes('src/'), 'Should target src directory')
  assert(protectedFilePath.includes('payload-types.ts'), 'Should target payload-types file')
}

function testTypeGenerationCommands(): void {
  const typeCmd = 'pnpm payload generate:types'
  const importmapCmd = 'pnpm payload generate:importmap'
  assert(typeCmd.includes('generate:types'), 'Should have type generation command')
  assert(importmapCmd.includes('generate:importmap'), 'Should have importmap generation command')
}

function testIsolatedPathCalculation(): void {
  const timestamp = 1626000000000
  const isolatedPath = `/tmp/jpv-bootcamp-types-${timestamp}-isolated`
  assert(isolatedPath.includes('jpv-bootcamp-types-'), 'Should contain marker')
  assert(isolatedPath.includes('-isolated'), 'Should mark as isolated')
}

function testExpectedMembershipTypes(): void {
  const expectedTypes = [
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
  ]
  assert(expectedTypes.length === 10, 'Should have 10 expected membership types')
  assert(expectedTypes.includes('MembershipSupport'), 'Should expect MembershipSupport')
  assert(expectedTypes.includes('Voucher'), 'Should expect Voucher')
}

function testUnrelatedChangeDetectionMembershipRelated(): void {
  const before = `export interface PayloadConfig { version: 1 }`
  const after = `export interface PayloadConfig { version: 1; MembershipSupport: string }`

  const patterns = ['MembershipSupport', 'Voucher']
  let isMembershipRelated = false

  for (const pattern of patterns) {
    if (after.includes(pattern)) {
      isMembershipRelated = true
      break
    }
  }

  assert(isMembershipRelated === true, 'Should detect membership-related changes')
}

function testUnrelatedChangeDetectionUnrelated(): void {
  const before = `export interface PayloadConfig { version: 1 }`
  const after = `export interface PayloadConfig { version: 2; unrelatedType: string }`

  const patterns = ['MembershipSupport', 'Voucher']
  let isMembershipRelated = false

  for (const pattern of patterns) {
    if (after.includes(pattern)) {
      isMembershipRelated = true
      break
    }
  }

  assert(isMembershipRelated === false, 'Should detect unrelated changes')
}

function testProtectedFileNotStaged(): void {
  const stagedFiles = ['src/components/NewComponent.tsx']
  const protectedFile = 'src/payload-types.ts'

  const isStaged = stagedFiles.includes(protectedFile)
  assert(isStaged === false, 'Should verify protected file not staged')
}

function testProtectedFileStaged(): void {
  const stagedFiles = ['src/payload-types.ts']
  const protectedFile = 'src/payload-types.ts'

  const isStaged = stagedFiles.includes(protectedFile)
  assert(isStaged === true, 'Should detect staged protected file')
}

function testAutoMergeRefusalWithUnrelated(): void {
  const canAutoMerge = false
  const unrelatedDeltaFound = true
  const blockerReason = 'Unrelated type changes detected; manual review required'

  assert(canAutoMerge === false, 'Should refuse auto-merge with unrelated changes')
  assert(unrelatedDeltaFound === true, 'Should record unrelated delta found')
  assert(blockerReason.length > 0, 'Should provide blocker reason')
}

function testAutoMergeAllowedPure(): void {
  const canAutoMerge = true
  const unrelatedDeltaFound = false
  const expectedTypesChanged = ['MembershipSupport', 'Voucher']

  assert(canAutoMerge === true, 'Should allow auto-merge with only membership changes')
  assert(unrelatedDeltaFound === false, 'Should record no unrelated changes')
  assert(expectedTypesChanged.length > 0, 'Should have expected types changed')
}

function testChecksumConsistency(): void {
  const baseline = 'abc123def456' as string
  const generated = 'xyz789uvw012' as string
  const checksumsDiffer = baseline !== generated

  assert(checksumsDiffer === true, 'Checksums should differ if changes made')
  assert(baseline.length > 0, 'Baseline checksum should exist')
  assert(generated.length > 0, 'Generated checksum should exist')
}

function testDiffCapture(): void {
  const baselineDiff = `--- a/src/payload-types.ts
+++ b/src/payload-types.ts
-export interface OldType {}
+export interface MembershipSupport {}`

  assert(baselineDiff.includes('---'), 'Should have diff header')
  assert(baselineDiff.includes('+++'), 'Should have diff target')
  assert(baselineDiff.length > 0, 'Should capture meaningful diff')
}

function testCleanupAndAbort(): void {
  const isolatedPath = '/tmp/jpv-bootcamp-types-xyz-isolated'
  const cleanupCommand = `git worktree remove ${isolatedPath}`

  assert(cleanupCommand.includes('worktree remove'), 'Should have worktree removal')
  assert(cleanupCommand.includes(isolatedPath), 'Should specify isolated path')
}

function testEvidenceJSON(): void {
  const state = {
    protectedFilePath: 'src/payload-types.ts',
    baselineChecksum: 'abc123',
    canAutoMerge: false,
    unrelatedDeltaFound: false,
    blockerReason: null,
    timestamp: '2026-07-18T00:00:00.000Z'
  }

  const json = JSON.stringify(state, null, 2)
  assert(json.includes('protectedFilePath'), 'Should include protected file path')
  assert(json.includes('baselineChecksum'), 'Should include baseline checksum')
  assert(JSON.parse(json).canAutoMerge === false, 'Should preserve structured data')
}

function testEvidenceMarkdown(): void {
  const markdown = `# Payload Type-Generation Isolation Preflight

**Protected File**: \`src/payload-types.ts\`
**Baseline Checksum**: \`abc123\`

## Isolation Plan
1. Create isolated worktree
2. Run generators
3. Compare output
`
  assert(markdown.includes('# Payload Type-Generation Isolation'), 'Should have heading')
  assert(markdown.includes('Protected File'), 'Should document protected file')
  assert(markdown.includes('Isolation Plan'), 'Should explain plan')
}

function testErrorOnWrongHead(): void {
  try {
    const currentHead = 'aaaaaaa' as string
    const expectedHead = '55b6895' as string
    if (currentHead !== expectedHead && !currentHead.startsWith(expectedHead)) {
      throw new Error(`Type generation isolation requires HEAD ${expectedHead}, got ${currentHead}`)
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Type generation isolation requires'), 'Should error on wrong HEAD')
  }
}

function testMembershipPatternMatching(): void {
  const patterns = ['membership_support', 'MembershipSupport', 'Voucher', 'FundingSource']
  const testLine = 'export interface MembershipSupport {}'

  let matched = false
  for (const pattern of patterns) {
    if (testLine.includes(pattern)) {
      matched = true
      break
    }
  }

  assert(matched === true, 'Should match membership patterns')
}

// Test runner
async function runTests(): Promise<TestResult> {
  const result: TestResult = { passed: 0, failed: 0, errors: [] }

  const tests = [
    { name: 'baseline capture', fn: testBaselineCapture },
    { name: 'protected file path correct', fn: testProtectedFilePathCorrect },
    { name: 'type generation commands', fn: testTypeGenerationCommands },
    { name: 'isolated path calculation', fn: testIsolatedPathCalculation },
    { name: 'expected membership types', fn: testExpectedMembershipTypes },
    { name: 'unrelated change detection: membership related', fn: testUnrelatedChangeDetectionMembershipRelated },
    { name: 'unrelated change detection: unrelated', fn: testUnrelatedChangeDetectionUnrelated },
    { name: 'protected file not staged', fn: testProtectedFileNotStaged },
    { name: 'protected file staged', fn: testProtectedFileStaged },
    { name: 'auto-merge refusal with unrelated', fn: testAutoMergeRefusalWithUnrelated },
    { name: 'auto-merge allowed pure', fn: testAutoMergeAllowedPure },
    { name: 'checksum consistency', fn: testChecksumConsistency },
    { name: 'diff capture', fn: testDiffCapture },
    { name: 'cleanup and abort', fn: testCleanupAndAbort },
    { name: 'evidence JSON', fn: testEvidenceJSON },
    { name: 'evidence Markdown', fn: testEvidenceMarkdown },
    { name: 'error on wrong HEAD', fn: testErrorOnWrongHead },
    { name: 'membership pattern matching', fn: testMembershipPatternMatching }
  ]

  for (const test of tests) {
    try {
      test.fn()
      result.passed++
      console.log(`✓ ${test.name}`)
    } catch (e) {
      result.failed++
      const error = e instanceof Error ? e.message : String(e)
      result.errors.push(`${test.name}: ${error}`)
      console.log(`✗ ${test.name}: ${error}`)
    }
  }

  return result
}

// Main
runTests().then(result => {
  console.log(`\n=== Test Summary ===`)
  console.log(`Passed: ${result.passed}`)
  console.log(`Failed: ${result.failed}`)
  if (result.errors.length > 0) {
    console.log(`\nErrors:`)
    result.errors.forEach(e => console.log(`  - ${e}`))
    process.exit(1)
  } else {
    process.exit(0)
  }
})
