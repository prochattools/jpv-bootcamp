#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.env.SKIP_PREDEV === '1') {
  console.log('SKIP_PREDEV=1 set; skipping predev database steps.')
  process.exit(0)
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const lines = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'))

  const map = {}
  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    map[key] = value
  }
  return map
}

function run(command, args, envOverride) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: envOverride || process.env
  })
  if (result.error) {
    console.error(`Failed to run ${command}:`, result.error.message)
    process.exit(1)
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

run('node', ['scripts/dev/bootstrap-env.js'])
run('node', ['scripts/db/init-tenant.js'])
run('node', ['scripts/dev/repair-migrations.js'])
run('node', ['scripts/dev/baseline-migrations.js'])

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
run(npmCmd, ['run', 'db:migrate:dev'])
