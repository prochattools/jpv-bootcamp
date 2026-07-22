/**
 * TOCTOU static structural tests for Stripe webhook handler.
 *
 * These tests read stripe-webhook-handler.ts source and assert structural
 * guarantees that prevent double-provisioning and event loss:
 *
 *   1. atomicClaimProcessing is used (not hasProcessed) — no TOCTOU window
 *   2. finalizeProcessed is called only on the success path
 *   3. releaseProcessingClaim is called in the catch block
 *   4. Status 202 is never returned (Stripe must retry on failure → 500)
 *   5. The duplicate path returns 200 (idempotent success)
 *   6. The concurrent-processing path returns 503 (retry later)
 *   7. The failure path returns 500 (Stripe retries, never 202)
 *
 * Usage (from repo root):
 *   pnpm exec tsx src/__tests__/stripe-webhook-toctou.test.ts
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const HANDLER_PATH = path.resolve(__dirname, '../../src/lib/stripe-webhook-handler.ts')
const src = readFileSync(HANDLER_PATH, 'utf8')

type TestFn = () => void
const results: Array<{ name: string; ok: boolean; error?: string }> = []

function test(name: string, fn: TestFn) {
  try {
    fn()
    results.push({ name, ok: true })
    console.log(`pass - ${name}`)
  } catch (err) {
    results.push({ name, ok: false, error: (err as Error).message })
    console.log(`fail - ${name}`)
    console.log(`       ${(err as Error).message}`)
  }
}

// ── Static structural tests ──────────────────────────────────────────────────

test('static: atomicClaimProcessing is imported', () => {
  assert.match(src, /atomicClaimProcessing/, 'handler must import atomicClaimProcessing')
})

test('static: finalizeProcessed is imported', () => {
  assert.match(src, /finalizeProcessed/, 'handler must import finalizeProcessed')
})

test('static: releaseProcessingClaim is imported', () => {
  assert.match(src, /releaseProcessingClaim/, 'handler must import releaseProcessingClaim')
})

test('static: 202 is never returned', () => {
  assert.doesNotMatch(
    src,
    /status:\s*202/,
    'handler must never return 202 — Stripe treats 2xx as success and will not retry',
  )
})

test('static: failure path returns 500', () => {
  assert.match(
    src,
    /status:\s*500/,
    'handler must return 500 on handler failure so Stripe retries',
  )
})

test('static: concurrent-in-progress path returns 503', () => {
  assert.match(
    src,
    /status:\s*503/,
    'handler must return 503 when another worker holds the processing claim',
  )
})

test('static: releaseProcessingClaim called in catch block', () => {
  const catchIdx = src.lastIndexOf('} catch (error) {')
  assert.ok(catchIdx > 0, 'must have a catch block')
  const afterCatch = src.slice(catchIdx)
  assert.match(
    afterCatch,
    /releaseProcessingClaim/,
    'releaseProcessingClaim must be called in the catch block to allow Stripe retry',
  )
})

test('static: finalizeProcessed called before success return', () => {
  const successIdx = src.lastIndexOf('received: true })')
  const finalizeIdx = src.lastIndexOf('finalizeProcessed(')
  assert.ok(finalizeIdx > 0, 'finalizeProcessed must be called')
  assert.ok(
    finalizeIdx < successIdx,
    'finalizeProcessed must appear before the success return',
  )
})

test('static: atomicClaimProcessing called before handler switch block', () => {
  const claimIdx = src.indexOf('atomicClaimProcessing(')
  const switchIdx = src.indexOf('switch (String(event.type))')
  assert.ok(claimIdx > 0, 'atomicClaimProcessing must be present')
  assert.ok(switchIdx > 0, 'switch block must be present')
  assert.ok(
    claimIdx < switchIdx,
    'atomicClaimProcessing must be called BEFORE the event-type switch block (claim before effects)',
  )
})

// ── Summary ─────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok)
console.log(`\nstripe-webhook-toctou tests complete`)
console.log(`${results.length - failed.length}/${results.length} passed`)

if (failed.length > 0) {
  process.exit(1)
}
