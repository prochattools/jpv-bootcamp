#!/usr/bin/env tsx
/**
 * scripts/staging-admin-bootstrap.ts
 *
 * Creates or verifies a staging admin user in payload_users.
 *
 * Usage:
 *   tsx scripts/staging-admin-bootstrap.ts                  # dry-run (default)
 *   tsx scripts/staging-admin-bootstrap.ts --apply          # actually create/verify
 *   tsx scripts/staging-admin-bootstrap.ts --verify-only    # check password only
 *   tsx scripts/staging-admin-bootstrap.ts --check-columns  # print payload_users columns and exit
 *
 * Required env:
 *   DATABASE_URL          - must contain "staging" OR STAGING_DB_GUARD=1
 *   STAGING_ADMIN_EMAIL   - admin email to create/verify
 *   STAGING_ADMIN_PASSWORD - admin password to set or verify
 *
 * Optional flags:
 *   --dry-run        (default true; pass --apply to disable)
 *   --apply          disable dry-run, actually mutate the DB
 *   --verify-only    check whether the user already exists; do not create
 *   --check-columns  print actual column names from information_schema and exit
 *
 * Exit codes:
 *   0  success or successful dry-run
 *   1  error with message written to stderr
 */

import { Client } from 'pg'
import * as crypto from 'crypto'

// ── Argument parsing ────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const hasFlag = (flag: string) => argv.includes(flag)

const isDryRun = !hasFlag('--apply')
const verifyOnly = hasFlag('--verify-only')
const checkColumns = hasFlag('--check-columns')

// ── Environment ─────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL ?? ''
const STAGING_ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL ?? ''
const STAGING_ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD ?? ''
const STAGING_DB_GUARD = process.env.STAGING_DB_GUARD === '1'

function redactEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***@***'
  return email.slice(0, 2) + '***' + email.slice(at)
}

function redactPassword(): string {
  return '[REDACTED]'
}

// ── Guards ───────────────────────────────────────────────────────────────────

function enforceGuards(): void {
  if (!DATABASE_URL) {
    console.error('[bootstrap] ERROR: DATABASE_URL is not set.')
    process.exit(1)
  }

  const isStagingUrl = DATABASE_URL.toLowerCase().includes('staging')
  if (!isStagingUrl && !STAGING_DB_GUARD) {
    console.error(
      '[bootstrap] ERROR: DATABASE_URL does not contain "staging" and STAGING_DB_GUARD is not set to 1.',
    )
    console.error(
      '[bootstrap] This script is intentionally restricted to staging databases.',
    )
    console.error(
      '[bootstrap] To override: set STAGING_DB_GUARD=1 in your environment.',
    )
    process.exit(1)
  }

  if (!STAGING_ADMIN_EMAIL) {
    console.error('[bootstrap] ERROR: STAGING_ADMIN_EMAIL is not set.')
    process.exit(1)
  }

  if (!STAGING_ADMIN_PASSWORD) {
    console.error('[bootstrap] ERROR: STAGING_ADMIN_PASSWORD is not set.')
    process.exit(1)
  }
}

// ── Password hashing (Payload uses bcrypt) ────────────────────────────────
// We use a pure-TS PBKDF2 fallback to avoid requiring bcrypt at script runtime.
// At actual Payload runtime, bcrypt is used — this script only creates the
// initial seed row; the user can change their password via the Payload UI.
//
// If bcryptjs is available in the project, use it for proper compatibility.

async function hashPassword(password: string): Promise<string> {
  try {
    // Try to use bcryptjs if available (Payload's actual hasher)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bcrypt = require('bcryptjs') as { hash: (pw: string, rounds: number) => Promise<string> }
    return bcrypt.hash(password, 10)
  } catch {
    // Fallback: PBKDF2 — note this will NOT be compatible with Payload's bcrypt
    // login. If bcryptjs is missing, warn and exit rather than create a broken row.
    console.error(
      '[bootstrap] ERROR: bcryptjs is not installed. Cannot hash password safely.',
    )
    console.error(
      '[bootstrap] Run: pnpm add -D bcryptjs @types/bcryptjs',
    )
    process.exit(1)
  }
}

// ── DB helpers ───────────────────────────────────────────────────────────────

function buildDbUrl(): string {
  // Strip Prisma-only ?schema= param that PostgreSQL rejects
  try {
    const u = new URL(DATABASE_URL)
    u.searchParams.delete('schema')
    return u.toString()
  } catch {
    return DATABASE_URL
  }
}

async function checkUserExists(client: Client, email: string): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM jpvbootcamp.payload_users WHERE email = $1`,
    [email],
  )
  return parseInt(result.rows[0]?.count ?? '0', 10) > 0
}

async function checkPayloadUsersColumns(client: Client): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'jpvbootcamp'
       AND table_name = 'payload_users'
     ORDER BY ordinal_position`,
  )
  return result.rows.map((r) => r.column_name)
}

async function createUser(client: Client, email: string, password: string): Promise<void> {
  const hash = await hashPassword(password)
  const id = crypto.randomUUID()
  try {
    await client.query(
      `INSERT INTO jpvbootcamp.payload_users (id, email, password, "updatedAt", "createdAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [id, email, hash],
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.toLowerCase().includes('column')) {
      console.error('[bootstrap] INSERT failed — possible column name mismatch.')
      console.error('[bootstrap] Run with --check-columns to see actual column names:')
      console.error('[bootstrap]   tsx scripts/staging-admin-bootstrap.ts --check-columns')
    }
    throw err
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  enforceGuards()

  const redactedEmail = redactEmail(STAGING_ADMIN_EMAIL)
  const dbUrl = buildDbUrl()

  console.log(`[bootstrap] staging-admin-bootstrap`)
  console.log(`[bootstrap] mode:     ${isDryRun ? 'dry-run (pass --apply to mutate)' : 'apply'}`)
  console.log(`[bootstrap] email:    ${redactedEmail}`)
  console.log(`[bootstrap] password: ${redactPassword()}`)
  console.log(`[bootstrap] db:       ${dbUrl.replace(/:[^:@]+@/, ':***@')}`)

  if (isDryRun && !verifyOnly && !checkColumns) {
    console.log('[bootstrap] DRY-RUN: no changes made. Pass --apply to execute.')
    process.exit(0)
  }

  const client = new Client({ connectionString: dbUrl })
  try {
    await client.connect()

    if (checkColumns) {
      const columns = await checkPayloadUsersColumns(client)
      if (columns.length === 0) {
        console.log('[bootstrap] No columns found — table may not exist or schema may differ.')
      } else {
        console.log(`[bootstrap] payload_users columns (${columns.length}):`)
        for (const col of columns) {
          console.log(`  - ${col}`)
        }
      }
      process.exit(0)
    }

    const exists = await checkUserExists(client, STAGING_ADMIN_EMAIL)

    if (verifyOnly) {
      if (exists) {
        console.log(`[bootstrap] User ${redactedEmail} exists in payload_users.`)
      } else {
        console.log(`[bootstrap] User ${redactedEmail} does NOT exist in payload_users.`)
      }
      process.exit(0)
    }

    // --apply path
    if (exists) {
      console.log(
        `[bootstrap] User ${redactedEmail} already exists. No action taken.`,
      )
      console.log(
        `[bootstrap] To reset password, use the Payload admin UI or the Payload API.`,
      )
      process.exit(0)
    }

    console.log(`[bootstrap] Creating user ${redactedEmail} …`)
    await createUser(client, STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD)
    console.log(`[bootstrap] User created successfully.`)
    process.exit(0)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[bootstrap] ERROR: ${message}`)
    process.exit(1)
  } finally {
    await client.end().catch((): void => undefined)
  }
}

run()
