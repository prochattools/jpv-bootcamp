/**
 * Portal Admin Mutation Smoke Gate
 *
 * Release gate: fails pnpm test:release if portal-admin mutation smoke has
 * not been run today.  Does NOT require STAGING_URL — reads only the evidence
 * file written by portal-admin-mutation-smoke.test.ts.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

type EvidenceFile = {
  target: string
  admin: string
  completedAt: string
  passed: number
  failed: number
  skipped?: number
  total: number
  createdIds: Record<string, string>
  reloadEvidence: string[]
  cleanup: string[]
  results: Array<{ id: string; status: string; note: string }>
}

const today = new Date().toISOString().slice(0, 10)
const evidencePath = path.join(process.cwd(), 'smoke-evidence', `mutations-${today}.json`)

if (!fs.existsSync(evidencePath)) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — Portal admin mutation smoke has not been run today (${today}).`,
  )
  console.error(
    `[portal-admin-smoke-gate] Run: STAGING_URL=https://preview.jpvbootcamp.com STAGING_ADMIN_EMAIL=... STAGING_ADMIN_PASSWORD=... pnpm exec tsx scripts/portal-admin-mutation-smoke.test.ts`,
  )
  process.exit(1)
}

let evidence: EvidenceFile
try {
  evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8')) as EvidenceFile
} catch {
  console.error(`[portal-admin-smoke-gate] FAIL — Evidence file is not valid JSON: ${evidencePath}`)
  process.exit(1)
}

if (typeof evidence.passed !== 'number' || typeof evidence.failed !== 'number') {
  console.error(`[portal-admin-smoke-gate] FAIL — Evidence file missing passed/failed counts`)
  process.exit(1)
}

if (evidence.failed > 0) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — Mutation smoke ran today but ${evidence.failed} test(s) failed.`,
  )
  console.error(
    `[portal-admin-smoke-gate] Re-run: pnpm exec tsx scripts/portal-admin-mutation-smoke.test.ts`,
  )
  process.exit(1)
}

if (evidence.passed === 0) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — Mutation smoke ran today but 0 tests passed (all skipped?).`,
  )
  process.exit(1)
}

// ── report ────────────────────────────────────────────────────────────────────

console.log(`[portal-admin-smoke-gate] PASS — Mutation smoke: ${evidence.passed} pass / ${evidence.failed} fail`)
console.log(`  target:    ${evidence.target}`)
console.log(`  admin:     ${evidence.admin}`)
console.log(`  completed: ${evidence.completedAt}`)

if (Object.keys(evidence.createdIds).length > 0) {
  console.log(`  createdIds: ${JSON.stringify(evidence.createdIds)}`)
}

if (evidence.reloadEvidence.length > 0) {
  console.log(`  reload evidence (${evidence.reloadEvidence.length}):`)
  for (const line of evidence.reloadEvidence) {
    console.log(`    - ${line}`)
  }
}

if (evidence.cleanup.length > 0) {
  console.log(`  cleanup (${evidence.cleanup.length}):`)
  for (const line of evidence.cleanup) {
    console.log(`    - ${line}`)
  }
}

// ── SA evidence check (BLOCKING — no skips allowed) ──────────────────────────

const saEvidencePath = path.join(process.cwd(), 'smoke-evidence', `server-actions-${today}.json`)
if (!fs.existsSync(saEvidencePath)) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — Server action smoke has not been run today (${today}).`,
  )
  console.error(
    `[portal-admin-smoke-gate] Run: set -a && source .env && set +a && pnpm exec tsx scripts/portal-admin-server-action-smoke.test.ts`,
  )
  process.exit(1)
}

let saEvidence: {
  passed?: number
  failed?: number
  skipped?: number
  total?: number
  localServerStarted?: boolean
  results?: Array<{ id: string; status: string; note: string }>
}
try {
  saEvidence = JSON.parse(fs.readFileSync(saEvidencePath, 'utf-8'))
} catch {
  console.error(`[portal-admin-smoke-gate] FAIL — SA evidence file is not valid JSON: ${saEvidencePath}`)
  process.exit(1)
}

const saPassed = saEvidence.passed ?? 0
const saFailed = saEvidence.failed ?? 0
const saSkipped = saEvidence.skipped ?? 0

if (saFailed > 0) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — SA smoke ran today but ${saFailed} test(s) failed.`,
  )
  console.error(
    `[portal-admin-smoke-gate] Re-run: set -a && source .env && set +a && pnpm exec tsx scripts/portal-admin-server-action-smoke.test.ts`,
  )
  process.exit(1)
}

if (saSkipped > 0) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — SA smoke has ${saSkipped} skipped test(s). All SA tests must PASS (no skips).`,
  )
  if (saEvidence.results) {
    for (const r of saEvidence.results) {
      if (r.status === 'SKIP') {
        console.error(`  SKIP: ${r.id} — ${r.note}`)
      }
    }
  }
  console.error(
    `[portal-admin-smoke-gate] Re-run: set -a && source .env && set +a && pnpm exec tsx scripts/portal-admin-server-action-smoke.test.ts`,
  )
  process.exit(1)
}

if (saPassed === 0) {
  console.error(
    `[portal-admin-smoke-gate] FAIL — SA smoke ran today but 0 tests passed.`,
  )
  process.exit(1)
}

console.log(`[portal-admin-smoke-gate] SA smoke: ${saPassed} pass / ${saFailed} fail / ${saSkipped} skip`)
if (saEvidence.localServerStarted === false) {
  console.log(`  NOTE: local server was not started — SA tests exercised staging only.`)
}

process.exit(0)
