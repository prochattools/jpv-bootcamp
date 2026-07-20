import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'run-remediation.sh')

// ─── stub directory ───────────────────────────────────────────────────────────
// Provides fake psql/curl that pass DEP_CHECK, then fail on actual calls,
// so structural/guard tests can exercise schema/secret checks in isolation.
let STUB_DIR: string | null = null

function getStubDir(): string {
  if (STUB_DIR) return STUB_DIR
  STUB_DIR = path.join(os.tmpdir(), `remediation-stubs-${process.pid}`)
  mkdirSync(STUB_DIR, { recursive: true })
  writeFileSync(path.join(STUB_DIR, 'psql'), '#!/bin/bash\nexit 1\n', { mode: 0o755 })
  writeFileSync(path.join(STUB_DIR, 'curl'), '#!/bin/bash\necho "curl_stub"\nexit 1\n', { mode: 0o755 })
  return STUB_DIR
}

function runScript(
  args: string[],
  env: Record<string, string> = {},
  useStubs = false,
): { code: number; stdout: string; stderr: string } {
  const extraPath = useStubs ? `${getStubDir()}:` : ''
  const result = spawnSync('bash', [SCRIPT, ...args], {
    env: {
      PATH: `${extraPath}${process.env.PATH ?? '/usr/bin:/bin'}`,
      DATABASE_URL: 'postgresql://user:pass@100.71.31.88/db?schema=jpvbootcamp_staging',
      ...env,
    },
    encoding: 'utf-8',
    // stdin: pipe so read -s doesn't hang waiting for a terminal
    input: '\n\n',
  })
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function main(): void {
  const scriptText = readFileSync(SCRIPT, 'utf-8')

  // ── utility file exists with bash shebang ────────────────────────────────
  assert.ok(existsSync(SCRIPT), `run-remediation.sh must exist at ${SCRIPT}`)
  assert.ok(scriptText.startsWith('#!/bin/bash'), 'must have bash shebang')

  // ── usage guard: no args ──────────────────────────────────────────────────
  {
    const { code, stderr } = runScript([])
    assert.equal(code, 2, 'exit 2 when no mode arg provided')
    assert.ok(stderr.includes('USAGE:'), `usage message on stderr, got: ${stderr}`)
  }

  // ── usage guard: unknown mode ─────────────────────────────────────────────
  {
    const { code, stderr } = runScript(['--run'])
    assert.equal(code, 2, 'exit 2 for unknown mode --run')
    assert.ok(stderr.includes('USAGE:'), `usage on stderr for unknown mode, got: ${stderr}`)
  }

  // ── static: DEP_CHECK block verifies all three deps ──────────────────────
  {
    const depSection = scriptText.split('DEP_CHECK')[1]?.split('SCHEMA_GUARD')[0] ?? ''
    assert.ok(depSection.includes('psql'), 'DEP_CHECK must check for psql')
    assert.ok(depSection.includes('node'), 'DEP_CHECK must check for node')
    assert.ok(depSection.includes('curl'), 'DEP_CHECK must check for curl')
    assert.ok(depSection.includes('ABORT'), 'DEP_CHECK must abort on missing dep')
  }

  // ── wrong host aborts ─────────────────────────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { DATABASE_URL: 'postgresql://u:p@10.0.0.1/db?schema=jpvbootcamp_staging',
        OLD_CREDENTIAL_PASSWORD: 'old12345678',
        NEW_CREDENTIAL_PASSWORD: 'new12345678!' },
      true,
    )
    assert.equal(code, 1, 'exit 1 for wrong DB host')
    assert.ok(stderr.includes('ABORT: wrong host'), `wrong host abort, got: ${stderr}`)
  }

  // ── wrong schema aborts ───────────────────────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { DATABASE_URL: 'postgresql://u:p@100.71.31.88/db?schema=jpvbootcamp_production',
        OLD_CREDENTIAL_PASSWORD: 'old12345678',
        NEW_CREDENTIAL_PASSWORD: 'new12345678!' },
      true,
    )
    assert.equal(code, 1, 'exit 1 for wrong DB schema')
    assert.ok(stderr.includes('ABORT: wrong schema'), `wrong schema abort, got: ${stderr}`)
  }

  // ── missing OLD_CREDENTIAL_PASSWORD aborts ────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { NEW_CREDENTIAL_PASSWORD: 'new12345678!' },
      true,
    )
    assert.equal(code, 1, 'exit 1 when OLD_CREDENTIAL_PASSWORD missing')
    assert.ok(stderr.includes('OLD_CREDENTIAL_PASSWORD'), `got: ${stderr}`)
  }

  // ── missing NEW_CREDENTIAL_PASSWORD aborts ────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { OLD_CREDENTIAL_PASSWORD: 'old12345678' },
      true,
    )
    assert.equal(code, 1, 'exit 1 when NEW_CREDENTIAL_PASSWORD missing')
    assert.ok(stderr.includes('NEW_CREDENTIAL_PASSWORD'), `got: ${stderr}`)
  }

  // ── short new password aborts ─────────────────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { OLD_CREDENTIAL_PASSWORD: 'old12345678',
        NEW_CREDENTIAL_PASSWORD: 'short' },
      true,
    )
    assert.equal(code, 1, 'exit 1 for short new password')
    assert.ok(stderr.includes('at least 12'), `got: ${stderr}`)
  }

  // ── secrets never appear in stdout or stderr ─────────────────────────────
  {
    const oldPass = 'SuperSecretOldPass_Unique_x999'
    const newPass = 'SuperSecretNewPass_Unique_x999!'
    const { stdout, stderr } = runScript(
      ['--preflight'],
      { DATABASE_URL: 'postgresql://u:p@1.2.3.4/db?schema=bad',
        OLD_CREDENTIAL_PASSWORD: oldPass,
        NEW_CREDENTIAL_PASSWORD: newPass },
      true,
    )
    const combined = stdout + stderr
    assert.ok(!combined.includes(oldPass), 'OLD_CREDENTIAL_PASSWORD must never appear in output')
    assert.ok(!combined.includes(newPass), 'NEW_CREDENTIAL_PASSWORD must never appear in output')
  }

  // ── static: interactive read -s prompt present ────────────────────────────
  {
    assert.ok(
      scriptText.includes('read -rs') || scriptText.includes('read -s'),
      'script must offer interactive read -s prompt for secrets',
    )
  }

  // ── static: no shell-history exposure in usage comment ────────────────────
  {
    const usageComment = scriptText.split('set -euo pipefail')[0] ?? ''
    // Usage must NOT show inline assignment (OLD_CREDENTIAL_PASSWORD=... bash ...)
    // which would land in shell history
    assert.ok(
      !usageComment.match(/OLD_CREDENTIAL_PASSWORD=\S+/),
      'usage comment must not show inline password assignment (shell history exposure)',
    )
  }

  // ── static: --preflight path contains no mutation SQL ────────────────────
  {
    const preflightSection = scriptText.split('=== EXECUTE MODE STARTING ===')[0] ?? ''
    const forbiddenLines = preflightSection
      .split('\n')
      .filter((line) => {
        if (line.trim().startsWith('#')) return false
        return /^\s*(psql|node)\s/.test(line) && /\b(UPDATE|DELETE|INSERT)\b/i.test(line)
      })
    assert.deepEqual(
      forbiddenLines, [],
      `preflight section must not contain mutation SQL:\n${forbiddenLines.join('\n')}`,
    )
  }

  // ── static: execute section contains all required step markers ───────────
  {
    const executeSection = scriptText.split('=== EXECUTE MODE STARTING ===')[1] ?? ''
    for (const step of [
      'STEP1_EMAIL_UPDATE',
      'STEP2_FORGOT_PASSWORD',
      'STEP3_TOKEN_EXTRACT',
      'STEP4_COMPLETE_RESET',
      'STEP5_REVOKE_SESSIONS',
      'STEP6_OLD_EMAIL_REJECTED',
      'STEP7_NEW_EMAIL_OLD_PASS_REJECTED',
      'STEP8_NEW_CREDENTIAL_ACCEPTED',
      'STEP8B_OLD_JWT_REJECTED',
      'STEP9_MEMBER_COUNT',
    ]) {
      assert.ok(executeSection.includes(step), `execute section must contain step marker ${step}`)
    }
  }

  // ── static: Steps 6 and 7 are fatal (ABORT, not WARNING) ─────────────────
  {
    const step6 = scriptText.split('STEP6_OLD_EMAIL_REJECTED')[1]?.split('STEP7')[0] ?? ''
    assert.ok(
      step6.includes('ABORT') && !step6.match(/^\s*echo "WARNING/m),
      'Step 6 must ABORT on non-401, must not just warn',
    )
    const step7 = scriptText.split('STEP7_NEW_EMAIL_OLD_PASS_REJECTED')[1]?.split('STEP8')[0] ?? ''
    assert.ok(
      step7.includes('ABORT') && !step7.match(/^\s*echo "WARNING/m),
      'Step 7 must ABORT on non-401, must not just warn',
    )
  }

  // ── static: network errors abort (net_error check present) ───────────────
  {
    const executeSection = scriptText.split('=== EXECUTE MODE STARTING ===')[1] ?? ''
    const netErrorAborts = (executeSection.match(/net_error/g) || []).length
    assert.ok(
      netErrorAborts >= 2,
      `execute section must check for net_error in at least 2 places, found ${netErrorAborts}`,
    )
  }

  // ── static: row-count assertion in Step 1 ────────────────────────────────
  {
    assert.ok(
      scriptText.includes('ROW_COUNT') && scriptText.includes('expected 1'),
      'Step 1 must assert row count via ROW_COUNT / expected 1',
    )
  }

  // ── static: session deletion row-count abort (not just warning) ──────────
  {
    const step5 = scriptText.split('STEP5_REVOKE_SESSIONS')[1]?.split('STEP6')[0] ?? ''
    assert.ok(
      step5.includes('ABORT') && step5.includes('sessions_after'),
      'Step 5 must ABORT if sessions_after != 0 (not just warn)',
    )
    assert.ok(
      !step5.match(/^\s*echo "WARNING.*sessions_after/m),
      'Step 5 must not demote session-count mismatch to a warning',
    )
  }

  // ── static: old JWT protected endpoint test present ───────────────────────
  {
    assert.ok(
      scriptText.includes('STEP8B_OLD_JWT_REJECTED'),
      'script must include STEP8B to prove old JWT rejected on protected endpoint',
    )
    assert.ok(
      scriptText.includes('/api/member-session'),
      'script must call /api/member-session as the protected endpoint for JWT proof',
    )
    assert.ok(
      scriptText.includes('JWT_REVOCATION_PROOF') || scriptText.includes('JWT_REVOCATION_MECHANISM'),
      'script must emit JWT revocation proof line (not just a note)',
    )
  }

  // ── static: old JWT accepted → ABORT (not silently ignored) ──────────────
  {
    const step8b = scriptText.split('STEP8B_OLD_JWT_REJECTED')[1]?.split('STEP9')[0] ?? ''
    assert.ok(
      step8b.includes('ABORT') && step8b.includes('still accepted'),
      'Step 8b must ABORT if old JWT is still accepted post-rotation',
    )
  }

  // ── static: JWT fingerprint uses SHA-256 (no raw prefix emission) ─────────
  {
    // Must use sha256 fingerprint, never substring(0,20) pattern
    assert.ok(
      scriptText.includes('sha256') || scriptText.includes('SHA-256'),
      'JWT fingerprints must use SHA-256 hash, not raw prefix',
    )
    assert.ok(
      !scriptText.includes('substring(0,20)'),
      'script must not emit raw JWT prefix — use SHA-256 fingerprint only',
    )
  }

  // ── static: no temp file written with password ────────────────────────────
  {
    assert.ok(
      !scriptText.includes('/tmp/stg_new_pass'),
      'script must not write password to /tmp file',
    )
  }

  // ── static: no inline password generation ────────────────────────────────
  {
    assert.ok(!scriptText.includes('Math.random()'), 'no Math.random() for password generation')
    assert.ok(
      !scriptText.match(/^\s*NEW_PASS=/m),
      'new password must come from env, not generated inline',
    )
  }

  // ── static: old email test uses captured variable, not placeholder ────────
  {
    const step6 = scriptText.split('STEP6_OLD_EMAIL_REJECTED')[1]?.split('STEP7')[0] ?? ''
    assert.ok(
      !step6.includes('step6test@staging.test'),
      'Step 6 must not use placeholder email',
    )
    assert.ok(
      step6.includes('_OLD_EMAIL') || step6.includes('CURRENT_EMAIL'),
      'Step 6 must reference the captured old email variable',
    )
  }

  // ── deprecated .mts duplicate must not exist ──────────────────────────────
  {
    const deprecated = path.join(__dirname, 'remediate-staging-credential.mts')
    assert.ok(!existsSync(deprecated), 'deprecated remediate-staging-credential.mts must be removed')
  }

  console.log('remediation_utility_contract.test.ts passed')
}

main()
