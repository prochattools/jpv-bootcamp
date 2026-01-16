#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

if (process.env.SKIP_PREDEV === '1') {
  console.log('SKIP_PREDEV=1 set; skipping predev database steps.')
  process.exit(0)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env })
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

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
run(npmCmd, ['run', 'db:migrate:dev'])
