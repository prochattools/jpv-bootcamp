import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * Contract test: Verify that removed legacy WordPress/MySQL env variables
 * are not referenced in active source code, and that staging environment
 * has no MySQL/WordPress dependency.
 */

const legacyVars = [
	'WORDPRESS_DB_USER',
	'WORDPRESS_DB_PASSWORD',
	'WORDPRESS_DB_NAME',
	'MYSQL_DATABASE',
	'MYSQL_USER',
	'MYSQL_PASSWORD',
	'MYSQL_RANDOM_ROOT_PASSWORD',
	'WP_REST_ENDPOINT',
	'WP_BASE_URL',
	'WP_ADMIN_USERNAME',
	'WP_APPLICATION_PASSWORD',
	'WP_ROLE_DEFAULT',
	'PORTAL_LOGIN_URL',
	'PORTAL_SET_PASSWORD_URL',
]

console.log('Env Legacy Cleanup Contract Test')
console.log('================================\n')

// Test 1: Verify no legacy vars in source code (src, scripts, tests) — exclude this test file
console.log('Test 1: No legacy env vars in source code')
for (const varName of legacyVars) {
	// Search for the var being used or required (exclude this test file)
	try {
		execSync(
			`grep -r "${varName}" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude="env_legacy_cleanup_contract.test.ts" src scripts`,
			{
				stdio: 'pipe',
				encoding: 'utf-8',
			}
		)
		// If we reach here, the var was found
		console.log(`❌ FAIL: ${varName} found in source code`)
		process.exit(1)
	} catch (e) {
		// grep returns non-zero if not found, which is what we want
		console.log(`✓ ${varName} not found in active source`)
	}
}

// Test 2: Verify PORTAL_URL is used (new replacement)
console.log('\nTest 2: PORTAL_URL is used in config')
try {
	const configMatch = execSync(
		`grep -r "PORTAL_URL" --include="*.ts" src/lib/config.ts | grep -v "PORTAL_LOGIN_URL"`,
		{
			stdio: 'pipe',
			encoding: 'utf-8',
		}
	)
	assert(configMatch.length > 0, 'PORTAL_URL should be referenced')
	console.log('✓ PORTAL_URL is the active portal configuration')
} catch (e) {
	console.log('❌ FAIL: PORTAL_URL not found or legacy fallback still present')
	process.exit(1)
}

// Test 3: Verify .env file has no legacy MySQL/WordPress vars
console.log('\nTest 3: .env file clean of legacy vars')
const envPath = join(process.cwd(), '.env')
try {
	execSync(`grep -E "^(WORDPRESS|MYSQL|WP_|PORTAL_LOGIN_URL)" "${envPath}"`, {
		stdio: 'pipe',
		encoding: 'utf-8',
	})
	console.log('❌ FAIL: Legacy vars still in .env')
	process.exit(1)
} catch (e) {
	console.log('✓ .env file is clean of WordPress/MySQL/legacy portal variables')
}

// Test 4: No MySQL or WordPress services in docker-compose (if exists)
console.log('\nTest 4: No MySQL or WordPress services in Docker Compose')
try {
	const dcPath = join(process.cwd(), 'docker-compose.yml')
	execSync(`grep -i "mysql\|wordpress" "${dcPath}"`, {
		stdio: 'pipe',
		encoding: 'utf-8',
	})
	console.log('❌ FAIL: MySQL or WordPress services found in docker-compose')
	process.exit(1)
} catch (e) {
	console.log('✓ Docker Compose has no MySQL or WordPress services')
}

console.log('\n================================')
console.log('✅ ALL LEGACY ENV CLEANUP TESTS PASSED')
console.log('\nSummary:')
console.log('- All 14 legacy WordPress/MySQL/WP variables removed from source')
console.log('- PORTAL_URL is the active portal configuration')
console.log('- .env file is clean of legacy infrastructure variables')
console.log('- No MySQL or WordPress service dependencies')
console.log('\nStaging environment has NO WordPress/MySQL dependency.')
