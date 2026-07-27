#!/usr/bin/env node

const assert = require('node:assert')

const baseUrl =
	process.env.APP_PUBLIC_URL ||
	process.env.NEXT_PUBLIC_APP_URL ||
	'http://localhost:3000'

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	try {
		return await fetch(url, { ...options, signal: controller.signal })
	} finally {
		clearTimeout(timeout)
	}
}

async function checkCheckout() {
	const url = `${baseUrl.replace(/\/$/, '')}/api/stripe/checkout?plan=membership`
	const response = await fetchWithTimeout(url, { redirect: 'manual' })
	if (response.status >= 500) {
		const body = await response.text()
		throw new Error(`Checkout failed with ${response.status}: ${body}`)
	}
	const okStatuses = new Set([200, 302, 303, 400])
	assert.ok(
		okStatuses.has(response.status),
		`Unexpected checkout status: ${response.status}`
	)
}

async function checkThankYou() {
	const url = `${baseUrl.replace(/\/$/, '')}/thank-you`
	const response = await fetchWithTimeout(url)
	assert.equal(response.status, 200, `Thank you page status: ${response.status}`)
	const html = await response.text()
	assert.ok(
		html.includes("Thanks - you're in."),
		'Thank you page copy missing.'
	)
}

async function main() {
	console.log(`[smoke] baseUrl=${baseUrl}`)
	await checkCheckout()
	console.log('[smoke] checkout endpoint ok')
	await checkThankYou()
	console.log('[smoke] thank-you page ok')
}

main().catch((error) => {
	console.error('[smoke] failed:', error.message)
	process.exit(1)
})
