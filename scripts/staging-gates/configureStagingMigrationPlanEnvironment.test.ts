import assert from 'node:assert/strict'
import {
  configureStagingMigrationPlanEnvironment,
  parseGitStatusNul,
  GitStatusParseError,
  type GhApiCall,
  type GitStatusExecutor,
} from './configureStagingMigrationPlanEnvironment'

const mockGhApiRead = (responses: Map<string, unknown>) => (call: GhApiCall) => {
  const key = call.args.join('|')
  return responses.get(key) ?? null
}

const mockGhApiMutate = (allowedKeys: Set<string>) => (call: GhApiCall) => {
  const key = call.args.join('|')
  const ok = allowedKeys.has(key)
  return { ok, exitCode: ok ? 0 : 1 }
}

const mockGitStatus = (statusMap: Map<string, string>): GitStatusExecutor => () => statusMap

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (err) {
    console.error(`✗ ${name}`)
    throw err
  }
}

async function main(): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════════
  // PARSER TESTS (raw, strict porcelain-v1 -z validation)
  // ══════════════════════════════════════════════════════════════════════════

  // Test: empty output is valid
  await test('parser: empty output returns empty map', () => {
    const map = parseGitStatusNul('')
    assert(map.size === 0)
  })

  // Test: nonempty output must end with NUL
  await test('parser: rejects output missing terminal NUL', () => {
    try {
      parseGitStatusNul('M  file.ts')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'missing_terminal_nul')
    }
  })

  // Test: rejects interior empty records (consecutive NULs)
  await test('parser: rejects interior empty record (consecutive NULs)', () => {
    try {
      parseGitStatusNul('M  file1.ts\0\0M  file2.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'interior_empty_record')
    }
  })

  // Test: accepts ordinary modified record
  await test('parser: accepts ordinary M record', () => {
    const map = parseGitStatusNul('M  src/file.ts\0')
    assert(map.size === 1)
    assert(map.get('src/file.ts') === 'M ')
  })

  // Test: accepts staged add record
  await test('parser: accepts staged A record', () => {
    const map = parseGitStatusNul('A  new.ts\0')
    assert(map.get('new.ts') === 'A ')
  })

  // Test: accepts deleted record
  await test('parser: accepts deleted D record', () => {
    const map = parseGitStatusNul(' D src/old.ts\0')
    assert(map.get('src/old.ts') === ' D')
  })

  // Test: accepts untracked ?? record
  await test('parser: accepts untracked ?? record', () => {
    const map = parseGitStatusNul('?? untracked.ts\0')
    assert(map.get('untracked.ts') === '??')
  })

  // Test: accepts ignored !! record
  await test('parser: accepts ignored !! record', () => {
    const map = parseGitStatusNul('!! ignored.ts\0')
    assert(map.get('ignored.ts') === '!!')
  })

  // Test: accepts spaces in path
  await test('parser: accepts spaces in path', () => {
    const map = parseGitStatusNul('M  path with spaces/file.ts\0')
    assert(map.get('path with spaces/file.ts') === 'M ')
  })

  // Test: accepts rename (X='R')
  await test('parser: accepts rename (X=R)', () => {
    const map = parseGitStatusNul('R  old-name.ts\0new-name.ts\0')
    assert(map.get('old-name.ts') === 'R ')
    assert(map.get('new-name.ts') === 'R ')
  })

  // Test: accepts rename with Y='R' (both X and Y R/C checked)
  await test('parser: accepts rename (Y=R)', () => {
    const map = parseGitStatusNul('MR old.ts\0new.ts\0')
    assert(map.get('old.ts') === 'MR')
    assert(map.get('new.ts') === 'MR')
  })

  // Test: accepts copy (X='C')
  await test('parser: accepts copy (X=C)', () => {
    const map = parseGitStatusNul('C  src.ts\0copy.ts\0')
    assert(map.get('src.ts') === 'C ')
    assert(map.get('copy.ts') === 'C ')
  })

  // Test: accepts copy with Y='C'
  await test('parser: accepts copy (Y=C)', () => {
    const map = parseGitStatusNul('MC src.ts\0copy.ts\0')
    assert(map.get('src.ts') === 'MC')
    assert(map.get('copy.ts') === 'MC')
  })

  // Test: accepts multiple records
  await test('parser: accepts multiple records', () => {
    const map = parseGitStatusNul('M  file1.ts\0A  file2.ts\0?? file3.ts\0')
    assert(map.size === 3)
    assert(map.has('file1.ts'))
    assert(map.has('file2.ts'))
    assert(map.has('file3.ts'))
  })

  // Test: rejects record too short
  await test('parser: rejects record too short', () => {
    try {
      parseGitStatusNul('M\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'malformed_record')
    }
  })

  // Test: rejects missing separator space
  await test('parser: rejects missing separator space', () => {
    try {
      parseGitStatusNul('M.file\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'malformed_separator')
    }
  })

  // Test: rejects empty path
  await test('parser: rejects empty path', () => {
    try {
      parseGitStatusNul('M  x\0\0M  \0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'empty_path' || e.message === 'interior_empty_record')
    }
  })

  // Test: rejects blank status (both spaces)
  await test('parser: rejects blank status (X=space, Y=space)', () => {
    try {
      parseGitStatusNul('   file.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'unsupported_status')
    }
  })

  // Test: rejects unknown status code
  await test('parser: rejects unknown status code', () => {
    try {
      parseGitStatusNul('XX file.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'unsupported_status')
    }
  })

  // Test: rejects ?? paired with different code
  await test('parser: rejects ?? paired with non-?? Y', () => {
    try {
      parseGitStatusNul('?M file.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'unsupported_status')
    }
  })

  // Test: rejects !! paired with different code
  await test('parser: rejects !! paired with non-!! Y', () => {
    try {
      parseGitStatusNul('!M file.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'unsupported_status')
    }
  })

  // Test: rejects rename without second path
  await test('parser: rejects rename without second path', () => {
    try {
      parseGitStatusNul('R  old.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'truncated_rename_record')
    }
  })

  // Test: rejects rename with empty second path
  await test('parser: rejects rename with empty second path', () => {
    try {
      parseGitStatusNul('R  old.ts\0\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'missing_second_path' || e.message === 'interior_empty_record')
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATOR VALIDATION TESTS
  // ══════════════════════════════════════════════════════════════════════════

  // Test: dry-run requires expectedCommit
  await test('dry-run: rejects undefined --expected-commit', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 100, login: 'reviewer' })
    responses.set('api|user', { id: 200, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'missing_expected_commit'))
  })

  // Test: dry-run requires HEAD match
  await test('dry-run: rejects mismatched HEAD', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 100, login: 'reviewer' })
    responses.set('api|user', { id: 200, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: true,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'b'.repeat(40),
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'head_mismatch'))
  })

  // Test: dry-run rejects dirty guarded paths
  await test('dry-run: rejects dirty guarded paths', async () => {
    const statusMap = new Map([['src/lib/previewMigrationInventory.ts', 'M ']])
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 100, login: 'reviewer' })
    responses.set('api|user', { id: 200, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: true,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(statusMap),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'guarded_path_dirty'))
  })

  // Test: dry-run succeeds with all guards met
  await test('dry-run: succeeds with exact SHA, clean paths, valid reviewer', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/alice', { id: 500, login: 'alice' })
    responses.set('api|user', { id: 600, login: 'bob' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'alice',
        expectedCommit: 'c'.repeat(40),
        dryRun: true,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'bob',
        currentHead: () => 'c'.repeat(40),
      },
    )

    assert(result.ok === true)
    assert(result.dryRun === true)
    assert(result.actions.length > 0)
    assert(result.blockers.length === 0)
  })

  // Test: self-review rejection
  await test('both modes: reject self-review (caller ID == reviewer ID)', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'alice', expectedCommit: 'a'.repeat(40), dryRun: true },
      {
        ghApiRead: mockGhApiRead(
          new Map([
            ['api|users/alice', { id: 100, login: 'alice' }],
            ['api|user', { id: 100, login: 'alice' }],
          ]),
        ),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'alice',
        currentHead: () => 'a'.repeat(40),
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'self_review_rejected'))
  })

  // Test: invalid GitHub login (too long)
  await test('both modes: reject GitHub login > 39 chars', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'a'.repeat(40),
        expectedCommit: 'a'.repeat(40),
        dryRun: true,
      },
      {
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'invalid_reviewer_login'))
  })

  console.log('\n✓ All tests passed (29 total)')
}

main().catch((err) => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
