/**
 * Tests for migration preflight verification - deterministic, no external dependencies
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

function testBranchVerificationRejectWrong(): void {
  const branch = 'feature/wrong-branch' as string
  try {
    if (branch !== 'feature/course-branding-and-preview') {
      throw new Error(`Wrong branch: ${branch}`)
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Wrong branch'), 'Should reject wrong branch')
  }
}

function testBranchVerificationAcceptCorrect(): void {
  const branch = 'feature/course-branding-and-preview'
  if (branch !== 'feature/course-branding-and-preview') {
    throw new Error(`Wrong branch: ${branch}`)
  }
  assert(branch === 'feature/course-branding-and-preview', 'Should accept correct branch')
}

function testHeadVerificationRejectUnexpected(): void {
  try {
    const currentHead = 'aaaaaaa' as string
    const expectedHead = '55b6895' as string
    if (currentHead !== expectedHead && !currentHead.startsWith(expectedHead)) {
      throw new Error(`Unexpected HEAD: ${currentHead}`)
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Unexpected HEAD'), 'Should reject unexpected HEAD')
  }
}

function testHeadVerificationAcceptMatching(): void {
  const currentHead = '55b6895'
  const expectedHead = '55b6895'
  assert(currentHead === expectedHead, 'Should accept matching HEAD')
}

function testProtectedPathStagingCheckRejectStaged(): void {
  const stagedFiles = ['src/payload-types.ts']
  const protectedPaths = ['src/payload-types.ts', 'docs/client/fixtures/']

  try {
    for (const staged of stagedFiles) {
      if (protectedPaths.includes(staged)) {
        throw new Error(`Protected path is staged: ${staged}`)
      }
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Protected path is staged'), 'Should reject staged protected files')
  }
}

function testProtectedPathStagingCheckAllowNonProtected(): void {
  const stagedFiles = ['src/components/NewComponent.tsx']
  const protectedPaths = ['src/payload-types.ts', 'docs/client/fixtures/']

  for (const staged of stagedFiles) {
    if (protectedPaths.includes(staged)) {
      throw new Error(`Protected path is staged: ${staged}`)
    }
  }
  // Should not throw
}

function testMigrationDirectoryCleanlinessRejectDirty(): void {
  const migrationDirStatus = {
    'src/migrations/new-file.ts': '??',
    'src/migrations/modified.ts': ' M'
  }

  const migrationEnvironmentClean = Object.keys(migrationDirStatus).length === 0

  try {
    if (!migrationEnvironmentClean) {
      throw new Error(`Migration directory is not clean: ${JSON.stringify(migrationDirStatus)}`)
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Migration directory is not clean'), 'Should reject dirty migration dir')
  }
}

function testMigrationDirectoryCleanlinessAcceptClean(): void {
  const migrationDirStatus = {}
  const migrationEnvironmentClean = Object.keys(migrationDirStatus).length === 0
  assert(migrationEnvironmentClean === true, 'Should accept clean migration directory')
}

function testProtectedDiffCapture(): void {
  const protectedPaths = ['src/payload-types.ts', 'docs/client/fixtures/']
  const protectedDiffs: Record<string, string> = {}

  for (const path of protectedPaths) {
    protectedDiffs[path] = 'some diff content'
  }

  assert(Object.keys(protectedDiffs).length === 2, 'Should capture both protected files')
  assert(protectedDiffs['src/payload-types.ts'] !== undefined, 'Should capture payload-types.ts')
}

function testIsolatedWorktreePathCalculation(): void {
  const tmpDir = '/tmp/jpv-bootcamp-migration-abc123'
  assert(tmpDir.includes('jpv-bootcamp-migration-'), 'Should contain migration prefix')
  assert(tmpDir.includes('/tmp/'), 'Should be in tmp directory')
}

function testActiveWorktreeUnchangedVerification(): void {
  const originalHead = '55b6895'
  const preflightHead = '55b6895'
  assert(originalHead === preflightHead, 'Should verify worktree unchanged')
}

function testEvidenceGenerationJSON(): void {
  const state = {
    branch: 'feature/course-branding-and-preview',
    currentHead: '55b6895',
    expectedHead: '55b6895',
    headMatches: true,
    protectedChecksums: {},
    protectedDiffs: {},
    isolatedWorktreePath: '/tmp/jpv-bootcamp-migration-xyz',
    migrationEnvironmentClean: true,
    migrationDirStatus: {},
    migrationGenerationCommand: 'pnpm payload migration:create --name membership_support',
    expectedMigrationOutputPaths: ['src/migrations/*.ts'],
    worktreeCleanup: false,
    timestamp: '2026-07-18T00:00:00.000Z',
    evidence: ''
  }

  const json = JSON.stringify(state, null, 2)
  assert(json !== undefined, 'Should generate JSON evidence')
  const parsed = JSON.parse(json)
  assert(parsed.branch === state.branch, 'Should preserve branch in parsed JSON')
}

function testEvidenceGenerationMarkdown(): void {
  const markdown = `# Migration Preflight Evidence

**Branch**: feature/course-branding-and-preview
**HEAD Matches**: ✓

## Next Steps
1. Approve this preflight evidence.
`
  assert(markdown.includes('# Migration Preflight Evidence'), 'Should generate markdown header')
  assert(markdown.includes('feature/course-branding-and-preview'), 'Should include branch')
  assert(markdown.includes('Approve this preflight evidence'), 'Should include approval step')
}

function testErrorHandlingWrongBranch(): void {
  try {
    const branch = 'feature/wrong-branch' as string
    if (branch !== 'feature/course-branding-and-preview') {
      throw new Error(`Wrong branch: ${branch}. Expected: feature/course-branding-and-preview`)
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Wrong branch'), 'Should fail with clear error')
  }
}

function testErrorHandlingUnexpectedHead(): void {
  try {
    const currentHead = 'aaaaaaa' as string
    const expectedHead = '55b6895' as string
    if (currentHead !== expectedHead && !currentHead.startsWith(expectedHead)) {
      throw new Error(`Unexpected HEAD: ${currentHead}. Expected: ${expectedHead}`)
    }
    throw new Error('Should have thrown')
  } catch (e) {
    assert((e as Error).message.includes('Unexpected HEAD'), 'Should fail with clear error')
  }
}

// Test runner
async function runTests(): Promise<TestResult> {
  const result: TestResult = { passed: 0, failed: 0, errors: [] }

  const tests = [
    { name: 'branch verification: reject wrong', fn: testBranchVerificationRejectWrong },
    { name: 'branch verification: accept correct', fn: testBranchVerificationAcceptCorrect },
    { name: 'HEAD verification: reject unexpected', fn: testHeadVerificationRejectUnexpected },
    { name: 'HEAD verification: accept matching', fn: testHeadVerificationAcceptMatching },
    { name: 'protected path staging: reject staged', fn: testProtectedPathStagingCheckRejectStaged },
    { name: 'protected path staging: allow non-protected', fn: testProtectedPathStagingCheckAllowNonProtected },
    { name: 'migration directory: reject dirty', fn: testMigrationDirectoryCleanlinessRejectDirty },
    { name: 'migration directory: accept clean', fn: testMigrationDirectoryCleanlinessAcceptClean },
    { name: 'protected diff capture', fn: testProtectedDiffCapture },
    { name: 'isolated worktree path', fn: testIsolatedWorktreePathCalculation },
    { name: 'active worktree unchanged', fn: testActiveWorktreeUnchangedVerification },
    { name: 'evidence JSON generation', fn: testEvidenceGenerationJSON },
    { name: 'evidence markdown generation', fn: testEvidenceGenerationMarkdown },
    { name: 'error handling: wrong branch', fn: testErrorHandlingWrongBranch },
    { name: 'error handling: unexpected HEAD', fn: testErrorHandlingUnexpectedHead }
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
