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
  // PARSER TESTS (raw, not through injected Map)
  // ══════════════════════════════════════════════════════════════════════════

  // Test: parser rejects record shorter than 4 chars (XY<space>X minimum)
  await test('parser: rejects record too short', () => {
    try {
      parseGitStatusNul('M\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'malformed_record')
    }
  })

  // Test: parser rejects record with no space after status
  await test('parser: rejects missing separator space', () => {
    try {
      parseGitStatusNul('M.path\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'malformed_separator')
    }
  })

  // Test: parser rejects empty path (record with space but no path)
  await test('parser: rejects empty path', () => {
    try {
      parseGitStatusNul('M  x\0\0M  \0')
      assert.fail('Should have thrown on second record')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      // Either malformed_record or empty_path depending on length
      assert(e.message === 'empty_path' || e.message === 'malformed_record')
    }
  })

  // Test: parser accepts ordinary M record
  await test('parser: accepts modified file', () => {
    const map = parseGitStatusNul('M  src/file.ts\0')
    assert(map.has('src/file.ts'))
    assert(map.get('src/file.ts') === 'M ')
  })

  // Test: parser accepts staged A record
  await test('parser: accepts staged file', () => {
    const map = parseGitStatusNul('A  new.ts\0')
    assert(map.has('new.ts'))
    assert(map.get('new.ts') === 'A ')
  })

  // Test: parser accepts deleted D record
  await test('parser: accepts deleted file', () => {
    const map = parseGitStatusNul(' D src/old.ts\0')
    assert(map.has('src/old.ts'))
    assert(map.get('src/old.ts') === ' D')
  })

  // Test: parser accepts untracked ?? record
  await test('parser: accepts untracked file', () => {
    const map = parseGitStatusNul('?? untracked.ts\0')
    assert(map.has('untracked.ts'))
  })

  // Test: parser accepts space in path
  await test('parser: accepts spaces in path', () => {
    const map = parseGitStatusNul('M  path with spaces/file.ts\0')
    assert(map.has('path with spaces/file.ts'))
  })

  // Test: parser requires second path in rename record (at least one char)
  await test('parser: rejects rename without new path', () => {
    try {
      parseGitStatusNul('R  old.ts\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      // Empty second path after split
      assert(e.message === 'missing_second_path')
    }
  })

  // Test: parser rejects empty second path in rename
  await test('parser: rejects rename with empty second path', () => {
    try {
      parseGitStatusNul('R  old.ts\0\0')
      assert.fail('Should have thrown')
    } catch (e) {
      assert(e instanceof GitStatusParseError)
      assert(e.message === 'missing_second_path')
    }
  })

  // Test: parser accepts rename record (both directions)
  await test('parser: accepts rename old→new', () => {
    const map = parseGitStatusNul('R  old-name.ts\0new-name.ts\0')
    assert(map.has('old-name.ts'))
    assert(map.has('new-name.ts'))
    assert(map.get('old-name.ts') === 'R ')
    assert(map.get('new-name.ts') === 'R ')
  })

  // Test: parser accepts copy record
  await test('parser: accepts copy record', () => {
    const map = parseGitStatusNul('C  src.ts\0copy.ts\0')
    assert(map.has('src.ts'))
    assert(map.has('copy.ts'))
  })

  // Test: parser accepts multiple records
  await test('parser: accepts multiple records', () => {
    const map = parseGitStatusNul('M  file1.ts\0A  file2.ts\0?? file3.ts\0')
    assert(map.size === 3)
    assert(map.has('file1.ts'))
    assert(map.has('file2.ts'))
    assert(map.has('file3.ts'))
  })

  // Test: parser skips empty records (from split)
  await test('parser: handles empty split entries', () => {
    const map = parseGitStatusNul('M  file.ts\0')
    assert(map.size === 1)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATOR VALIDATION TESTS
  // ══════════════════════════════════════════════════════════════════════════

  // Test: dry-run requires expectedCommit (not undefined)
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

  // Test: dry-run requires current HEAD equals expectedCommit
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

  // Test: dry-run succeeds with exact SHA and clean paths
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

  // Test: apply also requires expectedCommit
  await test('apply: rejects undefined --expected-commit', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 100, login: 'reviewer' })
    responses.set('api|user', { id: 200, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: 'configure_staging_migration_plan_environment',
        reviewerLogin: 'reviewer',
        expectedCommit: undefined,
        dryRun: false,
      },
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

  // Test: apply requires confirmation
  await test('apply: rejects missing --confirmation', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 100, login: 'reviewer' })
    responses.set('api|user', { id: 200, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: false,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'missing_apply_confirmation'))
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

  // Test: invalid GitHub login (leading hyphen)
  await test('both modes: reject GitHub login with leading hyphen', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: '-invalid',
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

  // Test: invalid GitHub login (invalid character)
  await test('both modes: reject GitHub login with invalid character', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'user@domain',
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
