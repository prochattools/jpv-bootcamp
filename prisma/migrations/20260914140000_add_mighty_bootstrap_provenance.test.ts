import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync('prisma/migrations/20260914140000_add_mighty_bootstrap_provenance/migration.sql', 'utf8')

test('provenance migration is expand-first and limited to mighty_access_sync', () => {
	assert.match(sql, /ALTER TABLE "mighty_access_sync"/)
	assert.match(sql, /ADD COLUMN "state_source" TEXT NOT NULL DEFAULT 'stripe_webhook'/)
	assert.match(sql, /ADD COLUMN "state_observed_at" TIMESTAMPTZ\(3\)/)
	assert.match(sql, /SET "state_observed_at" = "last_stripe_event_created_at"/)
	assert.match(sql, /WHERE "state_observed_at" IS NULL/)
	assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|UPDATE (?!"mighty_access_sync")/i)
	assert.equal((sql.match(/mighty_access_sync/g) ?? []).length, 2)
})
