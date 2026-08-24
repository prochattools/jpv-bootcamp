import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8')
}

function includes(sourceText: string, expected: string, file: string): void {
  assert.ok(sourceText.includes(expected), `${file} must contain ${expected}`)
}

async function main(): Promise<void> {
  const collection = await source('src/collections/community/Community.ts')
  const migration = await source('src/migrations/20260817_193300_space_reactions.ts')
  const documentation = await source('docs/design/JPV_P2_05_REACTION_IMPLEMENTATION.md')

  includes(collection, "slug: 'payload_space_reactions'", 'reaction collection')
  includes(collection, 'adminOnlyCollectionAccess', 'reaction collection')
  includes(collection, "value: 'like'", 'reaction collection')
  includes(collection, "value: 'bookmark'", 'reaction collection')
  includes(collection, "value: 'survey_vote'", 'reaction collection')
  includes(collection, "value: 'survey_option'", 'reaction collection')
  includes(collection, "name: 'actorMember'", 'reaction collection')
  includes(migration, 'payload_space_reactions_actor_type_post_unique_idx', 'reaction migration')
  includes(migration, 'payload_space_reactions_actor_type_comment_unique_idx', 'reaction migration')
  includes(migration, 'space_reactions_rollback_blocked_populated_table', 'reaction migration')

  includes(documentation, 'BLOCKED_PENDING_SCHEMA_AUTHORIZATION', 'P2-05 documentation')
  includes(documentation, 'does **not** safely support', 'P2-05 documentation')
  includes(documentation, 'No migration was created or run.', 'P2-05 documentation')
  includes(documentation, 'lesson-comment relationship or target kind', 'P2-05 documentation')
  includes(documentation, 'one active reaction per member and target', 'P2-05 documentation')
  includes(documentation, 'Approve one active reaction storage strategy', 'P2-05 documentation')

  console.log('p2_05_reaction_preflight: PASS')
}

void main()
