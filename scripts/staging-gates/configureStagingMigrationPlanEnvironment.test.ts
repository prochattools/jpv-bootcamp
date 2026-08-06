import assert from 'node:assert/strict'
import {
  configureStagingMigrationPlanEnvironment,
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
        gitStatus: mockGitStatus(new Map()),
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

  // Test: malformed reviewer login
  await test('rejects malformed reviewer login', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'user@domain', expectedCommit: undefined, dryRun: true },
    )
    assert(result.ok === false)
  })

  // Test: reviewer lookup failure
  await test('reports reviewer_lookup_failed on missing API response', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'notfound', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'reviewer_lookup_failed'))
  })

  // Test: reviewer canonical login mismatch
  await test('rejects reviewer if canonical login does not match case-insensitively', async () => {
    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'TestUser', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(new Map([['api|users/TestUser', { id: 1, login: 'differentuser' }]])),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )
    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'reviewer_lookup_failed'))
  })

  // Test: reviewer canonical login case-insensitive match
  await test('accepts reviewer with case-insensitive canonical login match', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/TestUser', { id: 200, login: 'testuser' })
    responses.set('api|user', { id: 1, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'TestUser', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )

    assert(result.ok === true)
    assert(result.actions.some((a) => a.includes('testuser')))
  })

  // Test: caller identity failure
  await test('reports caller_identity_failed on missing caller', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 200, login: 'reviewer' })

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => null,
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'caller_identity_failed'))
  })

  // Test: self-review rejection by numeric ID
  await test('rejects self-review when caller ID equals reviewer ID', async () => {
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

  // Test: git status parsing with NUL-terminated format
  await test('detects modified files via NUL-parsed git status', async () => {
    const statusMap = new Map([['scripts/staging-gates/configureStagingMigrationPlanEnvironment.ts', 'M ']])

    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 200, login: 'reviewer' })
    responses.set('api|user', { id: 100, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: 'configure_staging_migration_plan_environment',
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: false,
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
    assert(result.blockers.some((b) => b.includes('uncommitted changes')))
  })

  // Test: git status with renamed files
  await test('detects renamed files in git status', async () => {
    const statusMap = new Map([['package.json', 'R  -> package-new.json']])

    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 200, login: 'reviewer' })
    responses.set('api|user', { id: 100, login: 'caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: 'configure_staging_migration_plan_environment',
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: false,
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
  })

  // Test: error on variable read failure
  await test('reports github_api_call_failed on variable read failure', async () => {
    process.env.DATABASE_URL = 'mock_db'
    process.env.TAILSCALE_OAUTH_CLIENT_ID = 'mock_id'
    process.env.TAILSCALE_OAUTH_SECRET = 'mock_secret'

    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 200, login: 'reviewer' })
    responses.set('api|user', { id: 100, login: 'caller' })
    responses.set(
      'api|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan/deployment-branch-policies',
      { branch_policies: [] }
    )

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: 'configure_staging_migration_plan_environment',
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: false,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        ghApiMutate: mockGhApiMutate(
          new Set(['api|--method|PUT|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan|--header|Accept: application/vnd.github+json|--input|-'])
        ),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === false)
    assert(result.blockers.some((b) => b === 'github_api_call_failed'))
  })

  // Test: exact reviewer ID verification in post-apply
  await test('verifies exact reviewer ID after apply', async () => {
    process.env.DATABASE_URL = 'mock_db'
    process.env.TAILSCALE_OAUTH_CLIENT_ID = 'mock_id'
    process.env.TAILSCALE_OAUTH_SECRET = 'mock_secret'

    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', { id: 999, login: 'reviewer' })
    responses.set('api|user', { id: 100, login: 'caller' })
    responses.set(
      'api|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan/deployment-branch-policies',
      { branch_policies: [{ name: 'feature/course-branding-and-preview' }] }
    )
    responses.set('api|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan/variables', {
      variables: [{ name: 'PLAN_READY_FOR_DISPATCH', value: 'true' }],
    })
    responses.set('api|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan/secrets', {
      secrets: [
        { name: 'DATABASE_URL' },
        { name: 'TAILSCALE_OAUTH_CLIENT_ID' },
        { name: 'TAILSCALE_OAUTH_SECRET' },
      ],
    })
    responses.set('api|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan', {
      name: 'staging-migration-plan',
      protection_rules: [
        { type: 'required_reviewers', reviewers: [{ type: 'User', id: 999 }], prevent_self_review: true },
      ],
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: 'configure_staging_migration_plan_environment',
        reviewerLogin: 'reviewer',
        expectedCommit: 'a'.repeat(40),
        dryRun: false,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        ghApiMutate: mockGhApiMutate(
          new Set([
            'api|--method|PUT|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan|--header|Accept: application/vnd.github+json|--input|-',
            'api|--method|POST|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan/deployment-branch-policies|--input|-',
            'api|--method|PATCH|repos/prochattools/jpv-bootcamp/environments/staging-migration-plan/variables/PLAN_READY_FOR_DISPATCH|--input|-',
            'secret|set|DATABASE_URL|--env|staging-migration-plan|--repo|prochattools/jpv-bootcamp',
            'secret|set|TAILSCALE_OAUTH_CLIENT_ID|--env|staging-migration-plan|--repo|prochattools/jpv-bootcamp',
            'secret|set|TAILSCALE_OAUTH_SECRET|--env|staging-migration-plan|--repo|prochattools/jpv-bootcamp',
          ]),
        ),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
        currentHead: () => 'a'.repeat(40),
      },
    )

    assert(result.ok === true)
    assert(result.verifiedState.some((v) => v.includes('999')))
  })

  // Test: dry-run reports correct planned actions and reviewer
  await test('dry-run reports planned actions with reviewer', async () => {
    delete process.env.DATABASE_URL
    delete process.env.TAILSCALE_OAUTH_CLIENT_ID
    delete process.env.TAILSCALE_OAUTH_SECRET

    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/alice-reviewer', { id: 200, login: 'alice-reviewer' })
    responses.set('api|user', { id: 100, login: 'bob-caller' })

    const result = await configureStagingMigrationPlanEnvironment(
      {
        confirmation: undefined,
        reviewerLogin: 'alice-reviewer',
        expectedCommit: undefined,
        dryRun: true,
      },
      {
        ghApiRead: mockGhApiRead(responses),
        gitStatus: mockGitStatus(new Map()),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'bob-caller',
      },
    )

    assert(result.ok === true)
    assert(result.dryRun === true)
    assert(result.actions.length > 0)
    assert(result.actions.some((a) => a.includes('alice-reviewer')))
  })

  // Test: sanitized error messages
  await test('uses sanitized error codes not raw messages', async () => {
    const responses = new Map()
    responses.set('repo|view|--json|nameWithOwner|--jq|.nameWithOwner', 'prochattools/jpv-bootcamp')
    responses.set('api|users/reviewer', null)

    const result = await configureStagingMigrationPlanEnvironment(
      { confirmation: undefined, reviewerLogin: 'reviewer', expectedCommit: undefined, dryRun: true },
      {
        ghApiRead: mockGhApiRead(responses),
        repoName: () => 'prochattools/jpv-bootcamp',
        callerLogin: () => 'caller',
      },
    )

    assert(result.ok === false)
    assert(result.blockers.length > 0)
    assert(!result.blockers[0].includes('HTTP') && !result.blockers[0].includes('exception'))
  })

  console.log('\n✓ All tests passed')
}

main().catch((err) => {
  console.error('Test failed:', err.message)
  process.exit(1)
})
