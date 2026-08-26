import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8')
}

async function main(): Promise<void> {
  const migration = await source('src/migrations/20260824_120000_engagement_reactions.ts')
  const registry = await source('src/lib/payloadMigrationRegistry.ts')
  const index = await source('src/migrations/index.ts')
  const collection = await source('src/collections/community/EngagementReactions.ts')
  const legacyMigration = await source('src/migrations/20260817_193300_space_reactions.ts')

  for (const required of [
    'payload_engagement_reactions',
    'enum_payload_engagement_reactions_reaction_type',
    "AS ENUM('helpful', 'insightful', 'celebrate')",
    "AS ENUM('space_post', 'space_comment', 'lesson_comment')",
    'payload_engagement_reactions_target_shape',
    'payload_engagement_reactions_member_target_post_unique_idx',
    'payload_engagement_reactions_member_target_space_comment_unique_idx',
    'payload_engagement_reactions_member_target_lesson_comment_unique_idx',
    'engagement_reactions_rollback_blocked_populated_table',
  ]) {
    assert.equal(migration.includes(required), true, `new migration must contain ${required}`)
  }

  assert.equal(migration.includes('payload_space_reactions'), false, 'new migration must not modify the legacy table')
  assert.equal(migration.includes('INSERT INTO'), false, 'new migration must not backfill legacy rows')
  assert.equal(registry.includes("'20260824_120000_engagement_reactions'"), true)
  assert.equal(index.includes("'20260824_120000_engagement_reactions': migration_20260824_120000_engagement_reactions"), true)

  for (const required of [
    "slug: 'payload_engagement_reactions'",
    "name: 'member'",
    "name: 'reactionType'",
    "name: 'targetKind'",
    "name: 'targetPost'",
    "name: 'targetSpaceComment'",
    "name: 'targetLessonComment'",
    'adminOnlyCollectionAccess',
  ]) {
    assert.equal(collection.includes(required), true, `active collection must contain ${required}`)
  }

  assert.equal(legacyMigration.includes('payload_space_reactions'), true, 'legacy migration remains present')
  console.log('p2_05_reaction_migration_safety: PASS')
}

void main()
