import assert from 'node:assert/strict'
import {
  configureStagingMigrationPlanEnvironment,
  type GhApiCall,
} from './configureStagingMigrationPlanEnvironment'

const mockGhApiRead = (responses: Map<string, unknown>) => (call: GhApiCall) => {
  const key = call.args.join('|')
  return responses.get(key) ?? null
}

const mockGhApiMutate = (allowedKeys: Set<string>) => (call: GhApiCall) => {
  const key = call.args.join('|')
  const ok = allowedKeys.has(key)
  return { ok, status: ok ? 200 : 400 }
}

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
  // Test: dry-run with minimal inputs
  await test('dry-run with minimal inputs', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/testreviewer', { id: 12345, login: 'testreviewer' })
    responses.set('api|user', { id: 1000, login: 'testcaller' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'testreviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'testcaller',
        currentHead: () => null,
      },
    )

    assert(result.ok === true)
    assert(result.dryRun === true)
    assert(result.actions.length > 0)
    assert(result.blockers.length === 0)
  })

  // Test: rejects missing reviewer-login
  await test('rejects missing reviewer-login', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: undefined, expectedCommit: undefined, dryRun: true },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('reviewer-login')))
  })

  // Test: rejects wrong repository
  await test('rejects wrong repository', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'user', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(
          new Map([
            ['api|users/user', { id: 1, login: 'user' }],
            ['api|user', { id: 2, login: 'caller' }],
          ]),
        ),
        repoName: () => 'wrong/repo',
        callerLogin: () => 'caller',
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('Repository mismatch')))
  })

  // Test: rejects self-review
  await test('rejects self-review', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'alice', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(
          new Map([
            ['api|users/alice', { id: 100, login: 'alice' }],
            ['api|user', { id: 100, login: 'alice' }],
          ]),
        ),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'alice',
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('Self-review rejected')))
  })

  // Test: resolves reviewer login to numeric ID
  await test('resolves reviewer login to numeric ID', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewerlogin', { id: 42, login: 'reviewerlogin' })
    responses.set('api|user', { id: 1, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewerlogin', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )

    assert(result.ok === true)
    assert(result.actions.some((a) => a.includes('ID: 42')))
  })

  // Test: apply rejects missing confirmation
  await test('apply rejects missing confirmation', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'user', expectedCommit: 'abc123def456', dryRun: false },
      { ghApiRead: mockGhApiRead(new Map()) },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('--confirmation')))
  })

  // Test: apply rejects invalid SHA format
  await test('apply rejects invalid SHA format', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: 'configure_staging_migration_plan_environment',
        reviewerLogin: 'user',
        expectedCommit: 'invalid',
        dryRun: false,
      },
      { ghApiRead: mockGhApiRead(new Map()) },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('40-char hex SHA')))
  })

  // Test: never prints secrets to output
  await test('never prints secrets to output', async () => {
    const secretValue = 'super_secret_token_12345'
    process.env.DATABASE_URL = secretValue
    process.env.TAILSCALE_OAUTH_CLIENT_ID = 'client_id_secret'
    process.env.TAILSCALE_OAUTH_SECRET = 'oauth_secret'

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: (_call: GhApiCall) => {
          if (_call.args.includes('users/reviewer')) return { id: 1, login: 'reviewer' }
          return null
        },
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )

    const stringified = JSON.stringify(result)
    assert(!stringified.includes(secretValue))
    assert(!stringified.includes('super_secret'))
  })

  // Test: rejects malformed reviewer ID (non-numeric)
  await test('rejects malformed reviewer ID (non-numeric)', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'baduser', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(new Map([['api|users/baduser', { id: 'not_a_number', login: 'baduser' }]])),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('positive numeric ID')))
  })

  // Test: rejects zero or negative reviewer ID
  await test('rejects zero or negative reviewer ID', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'baduser', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(new Map([['api|users/baduser', { id: -1, login: 'baduser' }]])),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('positive numeric ID')))
  })

  // Test: resolves caller numeric ID and compares to reviewer
  await test('resolves caller numeric ID and compares to reviewer', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/bob', { id: 200, login: 'bob' })
    responses.set('api|user', { id: 100, login: 'alice' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'bob', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'alice',
      },
    )

    assert(result.ok === true)
    assert(result.actions.some((a) => a.includes('ID: 200')))
  })

  // Test: rejects when caller ID equals reviewer ID (numeric comparison)
  await test('rejects when caller ID equals reviewer ID', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/bob', { id: 100, login: 'bob' })
    responses.set('api|user', { id: 100, login: 'alice' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'bob', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'alice',
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('Self-review rejected')))
  })

  // Test: rejects malformed caller ID
  await test('rejects malformed caller ID', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/bob', { id: 200, login: 'bob' })
    responses.set('api|user', { id: 'invalid', login: 'alice' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'bob', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'alice',
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b.includes('positive numeric ID')))
  })

  // Test: expected commit validation in dry-run (not validated until apply)
  await test('dry-run does not validate expected-commit', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 200, login: 'reviewer' })
    responses.set('api|user', { id: 100, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === true, 'Dry-run should not require expected-commit')
  })


  // Test: dry-run with clean guarded paths
  await test('dry-run succeeds with clean guarded paths', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 200, login: 'reviewer' })
    responses.set('api|user', { id: 100, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === true)
    assert(result.dryRun === true)
  })

  console.log('\n✓ All tests passed')
}

main().catch((err) => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
