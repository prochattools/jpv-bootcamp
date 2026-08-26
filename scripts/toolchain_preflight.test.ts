import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function main(): void {
  assert.ok(existsSync('scripts/toolchain_preflight.ts'), 'toolchain preflight script should exist')

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    packageManager?: string
    engines?: { node?: string; pnpm?: string }
    scripts?: Record<string, string>
  }

  const script = readFileSync('scripts/toolchain_preflight.ts', 'utf8')
  const scripts = packageJson.scripts ?? {}
  const stagingStaticPreflight = scripts['staging:static-preflight'] ?? ''
  const toolchainCheck = scripts['toolchain:check'] ?? ''

  assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
  assert.ok(packageJson.engines?.node, 'package.json should define engines.node')
  assert.ok(packageJson.engines?.pnpm, 'package.json should define engines.pnpm')
  assert.ok(toolchainCheck, 'toolchain:check should exist')
  assert.match(toolchainCheck, /tsx scripts\/toolchain_preflight\.ts/)
  assert.ok(stagingStaticPreflight, 'staging:static-preflight should exist')
  assert.match(stagingStaticPreflight, /pnpm toolchain:check/)
  assert.match(stagingStaticPreflight, /pnpm evidence:validate/)
  assert.doesNotMatch(stagingStaticPreflight, /evidence:create/)

  assert.match(script, /pnpm@10\.33\.0/)
  assert.match(script, /corepack/)
  assert.match(script, /npx -y pnpm@10\.33\.0 staging:static-preflight/)
  assert.match(script, /supports pnpm major 9 or 10 only/i)
  assert.match(script, /pnpm major 9 or 10/i)
  assert.doesNotMatch(script, /prisma migrate/i)
  assert.doesNotMatch(script, /payload migrate/i)
  assert.doesNotMatch(script, /db push/i)
  assert.doesNotMatch(script, /fetch\(/i)
  assert.doesNotMatch(script, /\baxios\b/i)
  assert.doesNotMatch(script, /http\.request/i)
  assert.doesNotMatch(script, /https\.request/i)
  assert.doesNotMatch(script, /\.env/i)
  assert.doesNotMatch(script, /DATABASE_URL/i)
  assert.doesNotMatch(script, /\bchild_process\b/i)

  console.log('toolchain_preflight.test.ts passed')
}

main()
