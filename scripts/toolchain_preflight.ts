import { readFileSync } from 'node:fs'

type PackageJson = {
  packageManager?: string
  engines?: {
    node?: string
    pnpm?: string
  }
}

const REQUIRED_PACKAGE_MANAGER = 'pnpm@10.33.0'
const REQUIRED_PNPM_MAJOR_VERSIONS = new Set([9, 10])
const MIN_NODE_MAJOR = 20

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson
const { env: environment } = process

const problems: string[] = []
const warnings: string[] = []

const fail = (message: string): void => {
  problems.push(message)
}

const warn = (message: string): void => {
  warnings.push(message)
}

const printGuidance = (): void => {
  console.log('Toolchain preflight: local-only static check.')
  console.log('This script does not apply migrations, touch the database, or run network checks.')
  console.log('Recommended commands:')
  console.log('  corepack enable')
  console.log('  corepack prepare pnpm@10.33.0 --activate')
  console.log('  fallback: npx -y pnpm@10.33.0 staging:static-preflight')
}

const parseMajor = (value: string | undefined): number | null => {
  if (!value) return null
  const major = Number(value.split('.')[0])
  return Number.isInteger(major) ? major : null
}

const nodeMajor = parseMajor(process.versions.node)
if (nodeMajor == null) {
  fail(`Unable to determine Node major version from ${process.versions.node}.`)
} else if (nodeMajor < MIN_NODE_MAJOR) {
  fail(`Node ${process.versions.node} is too old. Use Node ${MIN_NODE_MAJOR}+.`)
}

if (packageJson.packageManager !== REQUIRED_PACKAGE_MANAGER) {
  fail(
    `packageManager must be exactly ${REQUIRED_PACKAGE_MANAGER}, found ${packageJson.packageManager ?? 'missing'}.`,
  )
}

if (!packageJson.engines?.node) {
  fail('package.json must define engines.node.')
}

if (!packageJson.engines?.pnpm) {
  fail('package.json must define engines.pnpm.')
}

const userAgent = environment.npm_config_user_agent ?? ''
const pnpmMatch = userAgent.match(/(?:^|\s)pnpm\/(\d+)\./)

if (pnpmMatch) {
  const pnpmMajor = Number(pnpmMatch[1])
  if (!Number.isInteger(pnpmMajor)) {
    fail(`Unable to parse pnpm major version from npm_config_user_agent: ${userAgent}`)
  } else if (pnpmMajor >= 11) {
    fail(
      `Detected pnpm major ${pnpmMajor}. This repo is pinned to ${REQUIRED_PACKAGE_MANAGER} and supports pnpm major 9 or 10 only.`,
    )
  } else if (!REQUIRED_PNPM_MAJOR_VERSIONS.has(pnpmMajor)) {
    fail(
      `Detected pnpm major ${pnpmMajor}. Use pnpm major 9 or 10 with ${REQUIRED_PACKAGE_MANAGER}.`,
    )
  }
} else {
  warn(
    'npm_config_user_agent did not expose pnpm. Run through Corepack with pnpm@10.33.0 or use the fallback command below.',
  )
}

printGuidance()

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`)
}

if (problems.length > 0) {
  console.error('Toolchain preflight failed:')
  for (const problem of problems) {
    console.error(`- ${problem}`)
  }
  process.exitCode = 1
} else {
  console.log(`Pinned package manager confirmed: ${REQUIRED_PACKAGE_MANAGER}`)
  console.log(`Node major version confirmed: ${nodeMajor ?? 'unknown'}`)
  if (pnpmMatch) {
    console.log(`pnpm major version accepted: ${pnpmMatch[1]}`)
  }
  console.log('No migrations were applied.')
  console.log('No database was touched.')
  console.log('No network checks were performed.')
}
