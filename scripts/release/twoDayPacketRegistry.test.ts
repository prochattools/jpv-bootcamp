import assert from 'node:assert/strict'

import {
  buildTwoDayPacketRegistryReport,
  validateTwoDayPacketRegistry,
  type TwoDayPacketRegistry,
} from './twoDayPacketRegistry'

const registry: TwoDayPacketRegistry = {
  generatedFrom: 'docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx',
  branch: 'feature/course-branding-and-preview',
  head: '8927df9',
  packets: [
    {
      id: 'SCHEMA-01',
      title: 'verify exact Membership Support schema delta',
      wave: 1,
      lane: 'SCHEMA',
      priority: 1,
      dependencies: [],
      sourcePaths: ['src/collections/membership-support/ReviewQueue.ts'],
      acceptanceCriteria: ['schema gap is documented and validated'],
      validationCommands: ['pnpm exec tsx scripts/membership_support_schema_contract.test.ts'],
      allowedOperations: ['read-only schema inspection'],
      prohibitedOperations: ['migration apply', 'type generation in the original worktree'],
      expectedChangedPaths: ['scripts/membership_support_schema_contract.test.ts'],
      expectedCommitMessage: 'feat(schema): add membership support schema contract checks',
      rollbackCondition: 'schema contract proves the queue delta is wrong',
      approvalGate: 'schema migration approval',
      parallelSafe: true,
      status: 'ready',
      blocker: null,
      commit: '8927df9',
      tests: ['scripts/membership_support_schema_contract.test.ts'],
    },
    {
      id: 'SCHEMA-02',
      title: 'prepare isolated migration-generation worktree procedure',
      wave: 1,
      lane: 'SCHEMA',
      priority: 2,
      dependencies: ['SCHEMA-01'],
      sourcePaths: ['scripts/release/membershipSupportSchemaIsolation.ts'],
      acceptanceCriteria: ['preflight branch and worktree validation is executable'],
      validationCommands: ['pnpm exec tsx scripts/release/membershipSupportSchemaIsolation.test.ts'],
      allowedOperations: ['read-only worktree planning'],
      prohibitedOperations: ['migration generation', 'type generation', 'protected-file writes'],
      expectedChangedPaths: ['scripts/release/membershipSupportSchemaIsolation.ts'],
      expectedCommitMessage: 'feat(schema): add membership support worktree isolation plan',
      rollbackCondition: 'worktree plan can touch protected files',
      approvalGate: 'schema migration approval',
      parallelSafe: true,
      status: 'ready',
      blocker: null,
      commit: '8927df9',
      tests: ['scripts/release/membershipSupportSchemaIsolation.test.ts'],
    },
  ],
}

function run(): void {
  const liveReport = buildTwoDayPacketRegistryReport()
  assert.equal(liveReport.ok, true)
  assert.match(liveReport.output, /SCHEMA-01/)
  assert.match(liveReport.output, /RELEASE-03/)

  assert.deepEqual(validateTwoDayPacketRegistry(registry), [])

  const report = buildTwoDayPacketRegistryReport(registry)
  assert.equal(report.ok, true)
  assert.match(report.output, /TWO DAY PACKET REGISTRY/)
  assert.match(report.output, /SCHEMA-01/)
  assert.match(report.output, /SCHEMA-02/)

  const cycleRegistry: TwoDayPacketRegistry = {
    ...registry,
    packets: [
      { ...registry.packets[0], dependencies: ['SCHEMA-02'] },
      { ...registry.packets[1], dependencies: ['SCHEMA-01'] },
    ],
  }
  assert(validateTwoDayPacketRegistry(cycleRegistry).some((error) => error.startsWith('dependency_cycle:')))
}

run()

console.log('two day packet registry tests passed')
