import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'run-remediation.sh')

// Stub directory: fake psql/curl/node that satisfy dep-check but fail fast
// for structural tests. We only inject these to get past DEP_CHECK so we can
// test the schema/secret/option guards in isolation.
let STUB_DIR: string | null = null

function getStubDir(): string {
  if (STUB_DIR) return STUB_DIR
  STUB_DIR = path.join(os.tmpdir(), `remediation-stubs-${process.pid}`)
  mkdirSync(STUB_DIR, { recursive: true })
  // psql: exits 1 on first real call (after dep-check passes)
  writeFileSync(
    path.join(STUB_DIR, 'psql'),
    '#!/bin/bash\nexit 1\n',
    { mode: 0o755 },
  )
  // curl: exits 1
  writeFileSync(
    path.join(STUB_DIR, 'curl'),
    '#!/bin/bash\necho "curl_stub"\nexit 1\n',
    { mode: 0o755 },
  )
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
  })
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function main(): void {
  // ── utility file exists with correct shebang ─────────────────────────────
  assert.ok(existsSync(SCRIPT), `run-remediation.sh must exist at ${SCRIPT}`)
  const scriptText = readFileSync(SCRIPT, 'utf-8')
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
    assert.ok(stderr.includes('USAGE:'), `usage message on stderr for unknown mode, got: ${stderr}`)
  }

  // ── static: dependency check block exists ────────────────────────────────
  {
    // Verify all three required commands are checked in the DEP_CHECK block
    const depSection = scriptText.split('DEP_CHECK')[1]?.split('SCHEMA_GUARD')[0] ?? ''
    assert.ok(depSection.includes('psql'), 'DEP_CHECK must check for psql')
    assert.ok(depSection.includes('node'), 'DEP_CHECK must check for node')
    assert.ok(depSection.includes('curl'), 'DEP_CHECK must check for curl')
    assert.ok(depSection.includes('ABORT'), 'DEP_CHECK must abort on missing dep')
  }

  // ── wrong host aborts (uses stubs to pass dep-check) ─────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      {
        DATABASE_URL: 'postgresql://u:p@10.0.0.1/db?schema=jpvbootcamp_staging',
        OLD_CREDENTIAL_PASSWORD: 'old',
        NEW_CREDENTIAL_PASSWORD: 'new12345678',
      },
      true,
    )
    assert.equal(code, 1, 'exit 1 for wrong DB host')
    assert.ok(
      stderr.includes('ABORT: wrong host'),
      `stderr must mention wrong host, got: ${stderr}`,
    )
  }

  // ── wrong schema aborts ───────────────────────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      {
        DATABASE_URL: 'postgresql://u:p@100.71.31.88/db?schema=jpvbootcamp_production',
        OLD_CREDENTIAL_PASSWORD: 'old',
        NEW_CREDENTIAL_PASSWORD: 'new12345678',
      },
      true,
    )
    assert.equal(code, 1, 'exit 1 for wrong DB schema')
    assert.ok(
      stderr.includes('ABORT: wrong schema'),
      `stderr must mention wrong schema, got: ${stderr}`,
    )
  }

  // ── missing OLD_CREDENTIAL_PASSWORD aborts ────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { NEW_CREDENTIAL_PASSWORD: 'new12345678' },
      true,
    )
    assert.equal(code, 1, 'exit 1 when OLD_CREDENTIAL_PASSWORD missing')
    assert.ok(
      stderr.includes('OLD_CREDENTIAL_PASSWORD'),
      `stderr must mention OLD_CREDENTIAL_PASSWORD, got: ${stderr}`,
    )
  }

  // ── missing NEW_CREDENTIAL_PASSWORD aborts ────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      { OLD_CREDENTIAL_PASSWORD: 'old' },
      true,
    )
    assert.equal(code, 1, 'exit 1 when NEW_CREDENTIAL_PASSWORD missing')
    assert.ok(
      stderr.includes('NEW_CREDENTIAL_PASSWORD'),
      `stderr must mention NEW_CREDENTIAL_PASSWORD, got: ${stderr}`,
    )
  }

  // ── short new password aborts ─────────────────────────────────────────────
  {
    const { code, stderr } = runScript(
      ['--preflight'],
      {
        OLD_CREDENTIAL_PASSWORD: 'old',
        NEW_CREDENTIAL_PASSWORD: 'short',
      },
      true,
    )
    assert.equal(code, 1, 'exit 1 when NEW_CREDENTIAL_PASSWORD is too short')
    assert.ok(
      stderr.includes('at least 12'),
      `stderr must mention 12-char minimum, got: ${stderr}`,
    )
  }

  // ── secrets never appear in output (tested pre-schema-guard) ─────────────
  {
    const oldPass = 'SuperSecretOldPass_Unique_999'
    const newPass = 'SuperSecretNewPass_Unique_999!'
    // Wrong host causes fast abort — but arg processing runs first
    const { stdout, stderr } = runScript(
      ['--preflight'],
      {
        DATABASE_URL: 'postgresql://u:p@1.2.3.4/db?schema=bad',
        OLD_CREDENTIAL_PASSWORD: oldPass,
        NEW_CREDENTIAL_PASSWORD: newPass,
      },
      true,
    )
    const combined = stdout + stderr
    assert.ok(!combined.includes(oldPass), 'OLD_CREDENTIAL_PASSWORD must never appear in output')
    assert.ok(!combined.includes(newPass), 'NEW_CREDENTIAL_PASSWORD must never appear in output')
  }

  // ── static: --preflight path must not contain mutation SQL ───────────────
  {
    const preflightSection = scriptText.split('EXECUTE MODE STARTING')[0] ?? ''
    const forbiddenLines = preflightSection
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('#')) return false
        // psql or node lines that contain unquoted UPDATE/DELETE/INSERT
        return (
          /^\s*(psql|node)\s/.test(line) &&
          /\b(UPDATE|DELETE|INSERT)\b/i.test(line)
        )
      })
    assert.deepEqual(
      forbiddenLines,
      [],
      `preflight section must not contain mutation SQL invocations:\n${forbiddenLines.join('\n')}`,
    )
  }

  // ── static: execute section contains all required step markers ───────────
  {
    const executeSection = scriptText.split('EXECUTE MODE STARTING')[1] ?? ''
    const requiredSteps = [
      'STEP1_EMAIL_UPDATE',
      'STEP2_FORGOT_PASSWORD',
      'STEP3_TOKEN_EXTRACT',
      'STEP4_COMPLETE_RESET',
      'STEP5_REVOKE_SESSIONS',
      'STEP6_OLD_EMAIL_REJECTED',
      'STEP7_NEW_EMAIL_OLD_PASS_REJECTED',
      'STEP8_NEW_CREDENTIAL_ACCEPTED',
      'STEP9_MEMBER_COUNT',
    ]
    for (const step of requiredSteps) {
      assert.ok(executeSection.includes(step), `execute section must contain step marker ${step}`)
    }
  }

  // ── static: row-count assertion in Step 1 ────────────────────────────────
  {
    assert.ok(
      scriptText.includes('ROW_COUNT') && scriptText.includes('expected 1'),
      'Step 1 must assert row count via ROW_COUNT / expected 1',
    )
  }

  // ── static: JWT revocation documented honestly ────────────────────────────
  {
    assert.ok(
      scriptText.includes('JWT_REVOCATION_NOTE') && scriptText.includes('stateless'),
      'script must document JWT revocation capability honestly',
    )
    assert.ok(
      !scriptText.includes('full JWT revocation'),
      'script must not claim unsupported full JWT revocation',
    )
  }

  // ── static: no temp file written with new password ────────────────────────
  {
    assert.ok(
      !scriptText.includes('/tmp/stg_new_pass'),
      'script must not write new password to /tmp file (secrets via env only)',
    )
  }

  // ── static: no inline password generation via Math.random or randomBytes ──
  {
    assert.ok(
      !scriptText.includes('Math.random()'),
      'script must not use Math.random() for password generation',
    )
    // Must not assign NEW_PASS= inline (old pattern) — password comes from env
    assert.ok(
      !scriptText.match(/^\s*NEW_PASS=/m),
      'new password must come from NEW_CREDENTIAL_PASSWORD env, not generated inline',
    )
  }

  // ── static: old email test uses real old email, not a placeholder ─────────
  {
    const step6Section = scriptText.split('STEP6_OLD_EMAIL_REJECTED')[1]?.split('STEP7')[0] ?? ''
    assert.ok(
      !step6Section.includes('step6test@staging.test'),
      'Step 6 must not use a placeholder email — must use the actual old email via variable',
    )
    assert.ok(
      step6Section.includes('_OLD_EMAIL') || step6Section.includes('CURRENT_EMAIL'),
      'Step 6 must reference the captured old email variable',
    )
  }

  // ── deprecated .mts duplicate must not exist ──────────────────────────────
  {
    const deprecated = path.join(__dirname, 'remediate-staging-credential.mts')
    assert.ok(
      !existsSync(deprecated),
      'deprecated duplicate remediate-staging-credential.mts must be removed',
    )
  }

  console.log('remediation_utility_contract.test.ts passed')
}

main()
