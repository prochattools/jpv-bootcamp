import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'

const root = process.cwd()
const memberProfile = readFileSync(path.join(root, 'src/migrations/20260818_140000_member_profile_parity.ts'), 'utf8')
const portalSettings = readFileSync(path.join(root, 'src/migrations/20260818_140100_portal_settings.ts'), 'utf8')

test('member profile parity migration persists exact source-proven fields', () => {
  for (const fragment of [
    '"cover_image_id" integer',
    '"website" varchar',
    '"biography" jsonb',
    '"social_links_instagram" varchar',
    '"social_links_twitter" varchar',
    '"social_links_linkedin" varchar',
    '"social_links_facebook" varchar',
    '"social_links_youtube" varchar',
    'payload_member_profiles_cover_image_id_payload_media_id_fk',
    'payload_member_profiles_cover_image_idx',
    'member_profile_parity_rollback_blocked_populated_columns',
  ]) assert.match(memberProfile, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('portal settings migration creates grouped fields and media relationships', () => {
  for (const fragment of [
    'CREATE TABLE ${schema}."portal_settings"',
    '"site_title" varchar',
    '"logo_id" integer',
    '"white_logo_id" integer',
    '"featured_image_id" integer',
    '"login_banner_title" varchar',
    '"login_banner_logo_id" integer',
    '"login_banner_background_image_id" integer',
    '"login_form_title" varchar',
    '"login_form_background_image_id" integer',
    '"legacy_settings" jsonb',
    'portal_settings_logo_id_payload_media_id_fk',
    'portal_settings_login_form_background_image_id_payload_media_id_fk',
    'portal_settings_rollback_blocked_populated_table',
  ]) assert.match(portalSettings, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('canonical registry ends with post-A-D parity migrations and totals 35', () => {
  assert.equal(PAYLOAD_MIGRATION_NAMES.length, 35)
  assert.deepEqual(PAYLOAD_MIGRATION_NAMES.slice(-2), [
    '20260818_140000_member_profile_parity',
    '20260818_140100_portal_settings',
  ])
})
