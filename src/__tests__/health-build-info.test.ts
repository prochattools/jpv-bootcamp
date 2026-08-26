import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const HEALTH_ROUTE = path.resolve(__dirname, '../../src/app/api/health/route.ts')
const DOCKERFILE = path.resolve(__dirname, '../../Dockerfile')
const DEPLOY_WORKFLOW = path.resolve(__dirname, '../../.github/workflows/deploy-preview.yml')

const healthSrc = readFileSync(HEALTH_ROUTE, 'utf8')
const dockerfileSrc = readFileSync(DOCKERFILE, 'utf8')
const deploySrc = readFileSync(DEPLOY_WORKFLOW, 'utf8')

const results: Array<{ name: string; ok: boolean; error?: string }> = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, ok: true })
    console.log(`pass - ${name}`)
  } catch (err) {
    results.push({ name, ok: false, error: (err as Error).message })
    console.log(`fail - ${name}: ${(err as Error).message}`)
  }
}

test('health route reads IMAGE_TAG env var', () => {
  assert.match(healthSrc, /IMAGE_TAG/, 'health route must read IMAGE_TAG')
})

test('health route reads COMMIT_SHA env var', () => {
  assert.match(healthSrc, /COMMIT_SHA/, 'health route must read COMMIT_SHA')
})

test('health route reads DEPLOYMENT_ENV env var', () => {
  assert.match(healthSrc, /DEPLOYMENT_ENV/, 'health route must read DEPLOYMENT_ENV')
})

test('Dockerfile declares IMAGE_TAG ARG', () => {
  assert.match(dockerfileSrc, /ARG IMAGE_TAG/, 'Dockerfile must declare IMAGE_TAG ARG')
})

test('Dockerfile declares COMMIT_SHA ARG', () => {
  assert.match(dockerfileSrc, /ARG COMMIT_SHA/, 'Dockerfile must declare COMMIT_SHA ARG')
})

test('deploy workflow passes IMAGE_TAG build-arg', () => {
  assert.match(deploySrc, /IMAGE_TAG=.*sha/, 'deploy workflow must pass IMAGE_TAG build-arg')
})

test('deploy workflow passes COMMIT_SHA build-arg', () => {
  assert.match(deploySrc, /COMMIT_SHA=.*sha/, 'deploy workflow must pass COMMIT_SHA build-arg')
})

const failed = results.filter(r => !r.ok)
console.log(`\nhealth-build-info tests complete: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) process.exit(1)
