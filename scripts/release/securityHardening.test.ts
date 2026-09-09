import { createRequire } from 'node:module'
import path from 'node:path'

type HeaderRule = {
	key: string
	value: string
}

type NextConfig = {
	poweredByHeader?: boolean
	headers?: () => Promise<Array<{ source: string; headers: HeaderRule[] }>> | Array<{ source: string; headers: HeaderRule[] }>
}

const require = createRequire(import.meta.url)
const config = require(path.resolve('next.config.js')) as NextConfig

async function test(): Promise<void> {
	if (config.poweredByHeader !== false) {
		throw new Error('next.config.js must disable the X-Powered-By header')
	}

	if (!config.headers) throw new Error('next.config.js must define application security headers')

	const rules = await config.headers()
	const globalRule = rules.find((rule) => rule.source === '/:path*')
	if (!globalRule) throw new Error('Security headers must apply to every request path')

	const headers = new Map(globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]))
	const required = new Map([
		['strict-transport-security', 'max-age=31536000; includeSubDomains'],
		['x-content-type-options', 'nosniff'],
		['x-frame-options', 'SAMEORIGIN'],
		['referrer-policy', 'strict-origin-when-cross-origin'],
		['permissions-policy', 'camera=(self), microphone=(self), geolocation=()'],
	])

	for (const [key, value] of required) {
		if (headers.get(key) !== value) throw new Error(`Security header mismatch: ${key}`)
	}

	console.log(`securityHardening.test.ts passed (${required.size + 1} checks)`)
}

test().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
