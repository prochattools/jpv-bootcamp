import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

const singularEnumMigration = read('src/migrations/20260723_000000_singular_membership_plan.ts')
const singularDataMigration = read('src/migrations/20260723_000001_migrate_pro_to_membership.ts')
const contentMigration = read('src/migrations/20260724_120000_operator_content_media.ts')
const billingMigration = read('src/migrations/20260724_121000_billing_operator_actions.ts')
const liveMigration = read('src/migrations/20260724_122000_live_session_relationships.ts')
const emailMigration = read('src/migrations/20260724_123000_email_operator_actions.ts')
const liveSpaceMigration = read('src/migrations/20260820_000000_live_session_space.ts')
const migrationIndex = read('src/migrations/index.ts')
const previewInventory = read('src/lib/previewMigrationInventory.ts')
const generatedTypes = read('src/payload-types.ts')

describe('consolidated Payload operator migrations', () => {
  it('registers all migrations in deterministic execution order', () => {
    const names = [
      '20260723_000000_singular_membership_plan',
      '20260723_000001_migrate_pro_to_membership',
      '20260724_120000_operator_content_media',
      '20260724_121000_billing_operator_actions',
      '20260724_122000_live_session_relationships',
      '20260724_123000_email_operator_actions',
    ]

    let previous = -1
    for (const name of names) {
      expect(migrationIndex).toContain(`'${name}'`)
      const position = migrationIndex.indexOf(`'${name}'`)
      expect(position).toBeGreaterThan(previous)
      previous = position
    }
  })

  it('splits singular membership enum creation from later data use', () => {
    expect(singularEnumMigration).toContain("ADD VALUE 'jpv_bootcamp_membership'")
    expect(singularEnumMigration).not.toContain("SET plan = 'jpv_bootcamp_membership'")
    expect(singularEnumMigration).not.toContain('payload_access_policies_allowed_plans')
    expect(singularEnumMigration).not.toContain('DROP TYPE')

    expect(singularDataMigration).toContain("SET plan = 'jpv_bootcamp_membership'")
    expect(singularDataMigration).toContain('DROP TABLE ${schema}.payload_access_policies_allowed_plans CASCADE')
    expect(singularDataMigration).toContain('DROP TYPE ${schema}.enum_payload_access_policies_allowed_plans')

    const updatePosition = singularDataMigration.indexOf("SET plan = 'jpv_bootcamp_membership'")
    const dropTablePosition = singularDataMigration.indexOf('DROP TABLE ${schema}.payload_access_policies_allowed_plans CASCADE')
    const downPosition = singularDataMigration.indexOf('export async function down')
    const reverseDataPosition = singularDataMigration.indexOf("SET plan = 'pro'", downPosition)
    const recreateEnumPosition = singularDataMigration.indexOf('CREATE TYPE ${schema}.enum_payload_access_policies_allowed_plans', downPosition)
    const recreateTablePosition = singularDataMigration.indexOf('CREATE TABLE ${schema}.payload_access_policies_allowed_plans', downPosition)

    expect(updatePosition).toBeGreaterThan(-1)
    expect(dropTablePosition).toBeGreaterThan(updatePosition)
    expect(reverseDataPosition).toBeGreaterThan(downPosition)
    expect(recreateEnumPosition).toBeGreaterThan(reverseDataPosition)
    expect(recreateTablePosition).toBeGreaterThan(recreateEnumPosition)
  })

  it('records exactly 36 canonical migrations', () => {
    expect(migrationIndex).toContain("'20260723_000001_migrate_pro_to_membership'")
    expect(migrationIndex).toContain("'20260804_050000_member_account_action_reservations'")
    expect(migrationIndex).toContain("'20260820_000000_live_session_space'")
    const entries = migrationIndex.match(/'2026\d{4}_\d{6}[a-z0-9_]*'/g) ?? []
    expect(entries).toHaveLength(36)
  })

  it('adds managed Page, Post, and Lesson media with guarded rollback', () => {
    expect(contentMigration).toContain('CREATE TYPE ${schema}."enum_payload_pages_status"')
    expect(contentMigration).toContain('CREATE TABLE ${schema}."payload_pages_rels"')
    expect(contentMigration).toContain('"featured_image_id" integer')
    expect(contentMigration).toContain('"featured_video_id" integer')
    expect(contentMigration).toContain('ADD COLUMN "payload_media_id" integer')
    expect(contentMigration).toContain('ADD COLUMN "cover_image_id" integer')
    expect(contentMigration).toContain('ADD COLUMN "bunny_video_id" integer')
    expect(contentMigration).toContain('rollback requires zero archived posts')
    expect(contentMigration).toContain('DROP TABLE IF EXISTS ${schema}."payload_pages_rels"')
    expect(contentMigration).toContain('Durable S3 media storage and hidden legacy admin controls')
    expect(contentMigration).not.toContain('PAYLOAD_MEDIA_S3_')
  })

  it('adds guarded Stripe operator actions and reversible enum handling', () => {
    for (const value of [
      'sync_subscription',
      'cancel_at_period_end',
      'resume_subscription',
      'payment_refunded',
      'payment_disputed',
      'dispute_resolved',
    ]) {
      expect(billingMigration).toContain(`'${value}'`)
    }

    expect(billingMigration).toContain('ADD COLUMN "subscription_id" integer')
    expect(billingMigration).toContain('ADD COLUMN "requested_by_id" integer')
    expect(billingMigration).toContain('ADD COLUMN "completed_at" timestamp(3) with time zone')
    expect(billingMigration).toContain('ADD COLUMN "result" jsonb')
    expect(billingMigration).toContain('rollback requires zero records using added action types')
    expect(billingMigration).toContain('CREATE TYPE ${schema}."enum_payload_billing_actions_action_type" AS ENUM(')
  })

  it('adds community space support to live sessions without breaking course columns', () => {
    expect(liveSpaceMigration).toContain('ADD COLUMN "space_id" integer')
    expect(liveSpaceMigration).toContain('ALTER COLUMN "course_id" DROP NOT NULL')
    expect(liveSpaceMigration).toContain('live_sessions_space_id_payload_spaces_id_fk')
    expect(liveSpaceMigration).toContain('live_sessions_course_or_space_required')
    expect(liveSpaceMigration).toContain('course_id" IS NOT NULL OR "space_id" IS NOT NULL')
    expect(liveSpaceMigration).toContain('DROP COLUMN IF EXISTS "space_id"')
    expect(liveSpaceMigration).toContain('ALTER COLUMN "course_id" SET NOT NULL')
  })

  it('preserves legacy Live Session text values while adding real relationships', () => {
    expect(liveMigration).toContain('RENAME COLUMN "module" TO "module_legacy"')
    expect(liveMigration).toContain('RENAME COLUMN "lesson" TO "lesson_legacy"')
    expect(liveMigration).toContain('ADD COLUMN "module_id" integer')
    expect(liveMigration).toContain('ADD COLUMN "lesson_id" integer')
    expect(liveMigration).toContain('ADD COLUMN "started_at" timestamp(3) with time zone')
    expect(liveMigration).toContain('ADD COLUMN "completed_at" timestamp(3) with time zone')
    expect(liveMigration).toContain('ADD COLUMN "cancelled_at" timestamp(3) with time zone')
    expect(liveMigration).toContain('No automatic relationship backfill is attempted')
    expect(liveMigration).toContain('rollback requires no sessions created after migration')
  })

  it('creates Email Actions, retry audit fields, and locked-document registration', () => {
    expect(emailMigration).toContain('CREATE TABLE ${schema}."payload_email_actions"')
    expect(emailMigration).toContain('"retry_count" numeric DEFAULT 0 NOT NULL')
    expect(emailMigration).toContain('"last_retry_requested_at" timestamp(3) with time zone')
    expect(emailMigration).toContain('"last_retry_requested_by_id" integer')
    expect(emailMigration).toContain('"payload_email_actions_id" integer')
    expect(emailMigration).toContain('payload_locked_documents_rels_payload_email_actions_fk')
    expect(emailMigration).toContain('DROP TABLE IF EXISTS ${schema}."payload_email_actions"')
  })

  it('contains deterministic down migrations and no manual data rewrites', () => {
    for (const migration of [contentMigration, billingMigration, liveMigration, emailMigration]) {
      expect(migration).toContain('export async function down')
      expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
      expect(migration).not.toMatch(/\bTRUNCATE\b/i)
      expect(migration).not.toMatch(/\bUPDATE\s+[^\n]+\s+SET\b/i)
    }
  })

  it('regenerates types for every completed operator slice', () => {
    expect(generatedTypes).toContain('export interface PayloadEmailAction')
    expect(generatedTypes).toContain('payload_email_actions: PayloadEmailAction;')
    expect(generatedTypes).toContain('featuredImage?: (number | null) | PayloadMedia;')
    expect(generatedTypes).toContain('gallery?: (number | PayloadMedia)[] | null;')
    expect(generatedTypes).toContain('bunnyVideo?: (number | null) | BunnyVideo;')
    expect(generatedTypes).toContain('module?: (number | null) | PayloadCourseModule;')
    expect(generatedTypes).toContain('startedAt?: string | null;')
    expect(generatedTypes).toContain('retryCount: number;')
    expect(generatedTypes).toContain("actionType: 'retry_delivery';")
  })

  it('keeps schema generation free of top-level server-only operator imports', () => {
    const billingCollection = read('src/collections/billing/Billing.ts')
    const crmCollection = read('src/collections/crm/CRM.ts')
    const payloadConfig = read('src/payload.config.ts')

    const billingImportPrelude = billingCollection.slice(0, billingCollection.indexOf('const billingGroup'))
    const crmImportPrelude = crmCollection.slice(0, crmCollection.indexOf('const crmGroup'))

    expect(billingImportPrelude).not.toContain('stripeOperatorActions')
    expect(crmImportPrelude).not.toContain('emailOperatorActions')
    expect(billingCollection).toContain("import('@/lib/billing/stripeOperatorActions')")
    expect(crmCollection).toContain("import('@/lib/email/emailOperatorActions')")
    expect(payloadConfig).toContain('process.env.PAYLOAD_MIGRATION_SCHEMA')
  })
})
