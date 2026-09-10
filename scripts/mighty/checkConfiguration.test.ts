import assert from 'node:assert/strict'
import test from 'node:test'

import { readFileSync } from 'node:fs'

import { checkConfiguration } from './checkConfiguration.mts'

const source = readFileSync('scripts/mighty/checkConfiguration.mts', 'utf8')

test('configuration check is read-only and never prints secret values', () => {
	assert.match(source, /readOnly: true/)
	assert.match(source, /MIGHTY_ADMIN_API_TOKEN/)
	assert.match(source, /MIGHTY_ACCESS_SYNC_WORKER_SECRET/)
	assert.match(source, /JSON\.stringify\(checkConfiguration\(\)/)
	assert.doesNotMatch(source, /console\.log\(.*env\./)
})

test('configuration check marks a complete shape ready while keeping Plan existence unverified', () => {
	const result = checkConfiguration({
		MIGHTY_API_BASE_URL: 'https://api.mn.co/admin/v1',
		MIGHTY_NETWORK_ID: '12345',
		MIGHTY_ACCESS_PLAN_ID: '678',
		MIGHTY_ADMIN_API_TOKEN: 'secret-token',
		MIGHTY_STUDENT_LOGIN_URL: 'https://jpv-community.mn.co/sign_in',
		MIGHTY_ACCESS_SYNC_WORKER_SECRET: 'worker-secret',
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'info@prochat.tools',
	})

	assert.equal(result.readyForAcceptance, true)
	assert.equal(result.planIdVerification, 'provider_lookup_required')
	assert.deepEqual(result.blockingReasons, [])
})

test('configuration check reports invalid shapes without exposing their values', () => {
	const result = checkConfiguration({
		MIGHTY_API_BASE_URL: 'http://api.mn.co/admin/v1',
		MIGHTY_ACCESS_PLAN_ID: 'placeholder',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'yes',
	})

	assert.equal(result.provider.MIGHTY_API_BASE_URL, 'INVALID')
	assert.equal(result.provider.MIGHTY_ACCESS_PLAN_ID, 'INVALID')
	assert.equal(result.controls.MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS, 'INVALID')
	assert.equal(result.readyForAcceptance, false)
	assert.ok(result.blockingReasons.includes('MIGHTY_ACCESS_PLAN_ID_INVALID'))
})

test('configuration check distinguishes missing Plan configuration from provider verification', () => {
	assert.match(source, /planIdVerification/)
	assert.match(source, /provider_lookup_required/)
	assert.match(source, /not_configured/)
})
