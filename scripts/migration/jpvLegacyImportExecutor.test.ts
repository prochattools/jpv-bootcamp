/**
 * Tests for jpvLegacyImportExecutor.ts
 *
 * Covers:
 *   - guardStagingIdentity: wrong host / schema / db
 *   - isOperationEffectivelyBlocked: AD-only vs mixed vs empty blockers
 *   - resolveRefs: $ref resolution, nested, unresolvable
 *   - topologicalSort: ordering, cycles, empty
 *   - flattenDataForSql: camelCase, groups, refs, missing columns
 *   - runJpvLegacyImport dry-run: correct counts, no DB writes
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  guardStagingIdentity,
  isOperationEffectivelyBlocked,
  resolveRefs,
  topologicalSort,
  flattenDataForSql,
  runJpvLegacyImport,
  type JpvImportConfig,
} from './jpvLegacyImportExecutor'
import type { LegacyPayloadOperationPlan, ProposedPayloadOperation } from './legacyPayloadOperationPlan'

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeOp(overrides: Partial<ProposedPayloadOperation> = {}): ProposedPayloadOperation {
  return {
    operationId: overrides.operationId ?? 'op_001',
    idempotencyKey: overrides.idempotencyKey ?? 'key_001',
    collection: overrides.collection ?? 'payload_members',
    action: 'proposed_create',
    data: overrides.data ?? { email: 'test@example.com', accountStatus: 'active', source: 'migration' },
    dependsOn: overrides.dependsOn ?? [],
    blockers: overrides.blockers ?? [],
    source: overrides.source ?? { system: 'wordpress', entityType: 'member', sourceIds: ['1'] },
    ...overrides,
  }
}

function makePlan(operations: ProposedPayloadOperation[]): LegacyPayloadOperationPlan {
  return {
    planVersion: '1.0',
    executionAuthorized: false,
    executable: false,
    snapshot: {
      sourceMemberAccounts: 0,
      canonicalSubscriberMembers: 0,
      activeSubscriberMembers: 0,
      blockedSubscriberMembers: 0,
      staffAuthorMirrors: 0,
    },
    operations,
    unresolved: [],
    summary: {
      operations: operations.length,
      blockedOperations: 0,
      byCollection: {},
      activeCourseEnrollments: 0,
      blockedHistoricalCourseEnrollments: 0,
      activeSpaceMemberships: 0,
      blockedHistoricalSpaceMemberships: 0,
      lessonProgress: 0,
      communityComments: 0,
      deferredLessonComments: 0,
      deferredOtherSourceComments: 0,
      communityReactions: 0,
      plannedLessonComments: 0,
      communityFileReferences: 0,
      lessonResourceReferences: 0,
      protectedLessonResourceMedia: 0,
      spaceDocumentReferences: 0,
      memberAvatarMediaReferences: 0,
      memberCoverMediaReferences: 0,
      portalSettingsMediaReferences: 0,
      courseCoverMediaReferences: 0,
      spaceMediaSchemaReferences: 0,
      platformArchiveMediaReferences: 0,
      unresolvedMediaRecords: 0,
      platformMediaAssetsAwaitingTargetDecision: 0,
    },
  }
}

// ─── guardStagingIdentity ────────────────────────────────────────────────────

describe('guardStagingIdentity', () => {
  const goodUrl = 'postgresql://user:pass@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging'

  it('passes on correct staging URL', () => {
    const result = guardStagingIdentity(goodUrl)
    assert.equal(result.hostname, '10.0.2.4')
    assert.equal(result.database, 'jpvbootcamp')
    assert.equal(result.schema, 'jpvbootcamp_staging')
  })

  it('passes on alternate staging host', () => {
    const url = 'postgresql://user:pass@100.71.31.88:5433/jpvbootcamp?schema=jpvbootcamp_staging'
    const result = guardStagingIdentity(url)
    assert.equal(result.hostname, '100.71.31.88')
  })

  it('rejects wrong host', () => {
    const url = 'postgresql://user:pass@1.2.3.4:5433/jpvbootcamp?schema=jpvbootcamp_staging'
    assert.throws(() => guardStagingIdentity(url), /staging_guard_failed.*host_rejected/)
  })

  it('rejects localhost (production risk)', () => {
    const url = 'postgresql://user:pass@localhost:5433/jpvbootcamp?schema=jpvbootcamp_staging'
    assert.throws(() => guardStagingIdentity(url), /staging_guard_failed/)
  })

  it('rejects wrong database', () => {
    const url = 'postgresql://user:pass@10.0.2.4:5433/production?schema=jpvbootcamp_staging'
    assert.throws(() => guardStagingIdentity(url), /staging_guard_failed.*database_rejected/)
  })

  it('rejects wrong schema', () => {
    const url = 'postgresql://user:pass@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_production'
    assert.throws(() => guardStagingIdentity(url), /staging_guard_failed.*schema_rejected/)
  })

  it('rejects malformed URL', () => {
    assert.throws(() => guardStagingIdentity('not-a-url'), /staging_guard_failed/)
  })
})

// ─── isOperationEffectivelyBlocked ───────────────────────────────────────────

describe('isOperationEffectivelyBlocked', () => {
  it('not blocked when no blockers', () => {
    const { blocked } = isOperationEffectivelyBlocked([])
    assert.equal(blocked, false)
  })

  it('not blocked when only AD-clearable blockers', () => {
    const { blocked } = isOperationEffectivelyBlocked([
      'bunny_target_schema_guid_first_compatibility_required',
      'lesson_comment_schema_registration_required',
    ])
    assert.equal(blocked, false)
  })

  it('not blocked when all four AD codes present', () => {
    const { blocked } = isOperationEffectivelyBlocked([
      'bunny_target_schema_guid_first_compatibility_required',
      'lesson_comment_schema_registration_required',
      'space_media_schema_registration_required',
      'community_reaction_schema_registration_required',
    ])
    assert.equal(blocked, false)
  })

  it('blocked when has non-AD blocker alone', () => {
    const { blocked, reason } = isOperationEffectivelyBlocked(['richtext_unresolved_image_media_resolution_required'])
    assert.equal(blocked, true)
    assert.ok(reason?.includes('richtext_unresolved_image_media_resolution_required'))
  })

  it('blocked when mixed AD and non-AD blockers', () => {
    const { blocked } = isOperationEffectivelyBlocked([
      'lesson_comment_schema_registration_required',
      'unresolved_comment_author',
    ])
    assert.equal(blocked, true)
  })

  it('reason contains only the non-AD blockers', () => {
    const { reason } = isOperationEffectivelyBlocked([
      'lesson_comment_schema_registration_required',
      'unresolved_comment_author',
      'unresolved_comment_lesson',
    ])
    assert.ok(reason?.includes('unresolved_comment_author'))
    assert.ok(reason?.includes('unresolved_comment_lesson'))
    assert.ok(!reason?.includes('lesson_comment_schema_registration_required'))
  })
})

// ─── resolveRefs ─────────────────────────────────────────────────────────────

describe('resolveRefs', () => {
  it('resolves $ref string to numeric ID', () => {
    const map = new Map([['op_001', 42]])
    const result = resolveRefs({ member: '$ref:op_001' }, map)
    assert.equal(result['member'], 42)
  })

  it('resolves nested $ref in group objects', () => {
    const map = new Map([['op_lesson', 7]])
    const result = resolveRefs({ nested: { lesson: '$ref:op_lesson' } }, map)
    const nested = result['nested'] as Record<string, unknown>
    assert.equal(nested['lesson'], 7)
  })

  it('throws on unresolvable ref', () => {
    const map = new Map<string, number>()
    assert.throws(() => resolveRefs({ member: '$ref:missing_op' }, map), /unresolved_ref/)
  })

  it('passes through non-ref values unchanged', () => {
    const map = new Map<string, number>()
    const result = resolveRefs({ email: 'x@y.com', count: 5, flag: true }, map)
    assert.equal(result['email'], 'x@y.com')
    assert.equal(result['count'], 5)
    assert.equal(result['flag'], true)
  })

  it('passes through null values', () => {
    const map = new Map<string, number>()
    const result = resolveRefs({ value: null }, map)
    assert.equal(result['value'], null)
  })
})

// ─── topologicalSort ─────────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('returns empty for empty input', () => {
    assert.deepEqual(topologicalSort([]), [])
  })

  it('single op with no deps', () => {
    const ops = [makeOp({ operationId: 'op_a', dependsOn: [] })]
    const sorted = topologicalSort(ops)
    assert.equal(sorted.length, 1)
    assert.equal(sorted[0]!.operationId, 'op_a')
  })

  it('parent comes before child', () => {
    const parent = makeOp({ operationId: 'op_parent', dependsOn: [] })
    const child = makeOp({ operationId: 'op_child', dependsOn: ['op_parent'] })
    const sorted = topologicalSort([child, parent])
    const parentIdx = sorted.findIndex((op) => op.operationId === 'op_parent')
    const childIdx = sorted.findIndex((op) => op.operationId === 'op_child')
    assert.ok(parentIdx < childIdx, `parent (${parentIdx}) should come before child (${childIdx})`)
  })

  it('chain: A → B → C in order', () => {
    const a = makeOp({ operationId: 'op_a', dependsOn: [] })
    const b = makeOp({ operationId: 'op_b', dependsOn: ['op_a'] })
    const c = makeOp({ operationId: 'op_c', dependsOn: ['op_b'] })
    const sorted = topologicalSort([c, b, a])
    assert.equal(sorted[0]!.operationId, 'op_a')
    assert.equal(sorted[1]!.operationId, 'op_b')
    assert.equal(sorted[2]!.operationId, 'op_c')
  })

  it('throws on cycle', () => {
    const a = makeOp({ operationId: 'op_a', dependsOn: ['op_b'] })
    const b = makeOp({ operationId: 'op_b', dependsOn: ['op_a'] })
    assert.throws(() => topologicalSort([a, b]), /topological_sort_cycle_detected/)
  })

  it('ignores external deps not in operation list', () => {
    const op = makeOp({ operationId: 'op_a', dependsOn: ['external_op'] })
    const sorted = topologicalSort([op])
    assert.equal(sorted.length, 1)
  })
})

// ─── flattenDataForSql ────────────────────────────────────────────────────────

describe('flattenDataForSql', () => {
  it('converts camelCase to snake_case', () => {
    const cols = new Set(['account_status', 'updated_at'])
    const result = flattenDataForSql({ accountStatus: 'active' }, cols)
    assert.equal(result['account_status'], 'active')
  })

  it('drops columns not in availableColumns', () => {
    const cols = new Set(['email'])
    const result = flattenDataForSql({ email: 'x@y.com', biography: { root: {} } }, cols)
    assert.ok('email' in result)
    assert.ok(!('biography' in result))
  })

  it('flattens group fields with prefix', () => {
    const cols = new Set(['social_links_instagram', 'social_links_twitter'])
    const result = flattenDataForSql({ socialLinks: { instagram: 'ig', twitter: 'tw' } }, cols)
    assert.equal(result['social_links_instagram'], 'ig')
    assert.equal(result['social_links_twitter'], 'tw')
  })

  it('maps resolved FK refs to _id columns', () => {
    const cols = new Set(['member_id', 'lesson_id'])
    // resolveRefs converts "$ref:X" → number. The key stays as "member".
    const result = flattenDataForSql({ member: 42, lesson: 7 }, cols)
    assert.equal(result['member_id'], 42)
    assert.equal(result['lesson_id'], 7)
  })

  it('serializes arrays as JSON string when column present', () => {
    const cols = new Set(['tags'])
    const result = flattenDataForSql({ tags: ['a', 'b'] }, cols)
    assert.equal(result['tags'], JSON.stringify(['a', 'b']))
  })

  it('never includes id column', () => {
    const cols = new Set(['id', 'email'])
    const result = flattenDataForSql({ id: 999, email: 'x@y.com' }, cols)
    assert.ok(!('id' in result))
    assert.ok('email' in result)
  })
})

// ─── runJpvLegacyImport dry-run ───────────────────────────────────────────────

describe('runJpvLegacyImport dry-run', () => {
  it('returns correct counts and no writes for simple plan', async () => {
    const ops = [
      makeOp({ operationId: 'op_member', blockers: [], dependsOn: [] }),
      makeOp({ operationId: 'op_profile', collection: 'payload_member_profiles', blockers: [], dependsOn: ['op_member'] }),
      makeOp({ operationId: 'op_blocked', blockers: ['unresolved_comment_author'], dependsOn: [] }),
      makeOp({ operationId: 'op_ad_only', blockers: ['lesson_comment_schema_registration_required'], dependsOn: [] }),
      makeOp({ operationId: 'op_global', targetType: 'global', globalSlug: 'portalSettings', blockers: [], dependsOn: [] }),
    ]
    const plan = makePlan(ops)

    const config: JpvImportConfig = {
      mode: 'dry-run',
      databaseUrl: 'postgresql://user:pass@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging',
      runId: 'test_run_001',
      operationPlan: plan,
    }

    const result = await runJpvLegacyImport(config)

    assert.equal(result.ok, true)
    assert.equal(result.mode, 'dry-run')
    assert.equal(result.proposedOperations, 5)
    assert.equal(result.executedOperations, 0, 'dry-run must not execute any writes')
    assert.equal(result.alreadyAppliedOperations, 0)
    // 1 blocked (non-AD), 1 global (missing table)
    assert.equal(result.skippedOperations, 2)
    assert.equal(result.skippedByMissingTable, 1)
    assert.equal(result.failedOperations, 0)
    assert.ok(result.durationMs >= 0)
  })

  it('AD-only blocked ops are not counted as skipped in dry-run', async () => {
    const ops = [
      makeOp({ operationId: 'op_ad', blockers: ['bunny_target_schema_guid_first_compatibility_required'], dependsOn: [] }),
    ]
    const plan = makePlan(ops)
    const config: JpvImportConfig = {
      mode: 'dry-run',
      databaseUrl: 'postgresql://user:pass@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging',
      runId: 'test_run_002',
      operationPlan: plan,
    }
    const result = await runJpvLegacyImport(config)
    assert.equal(result.skippedOperations, 0)
  })
})
