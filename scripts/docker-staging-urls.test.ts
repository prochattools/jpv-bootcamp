import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Contract test: Verify that staging Docker builds receive
 * https://staging.jpvbootcamp.com URLs, never production jpvbootcamp.com.
 *
 * This proves the Docker build does not accidentally bake production
 * URLs into staging preview images.
 */

const dockerfile = readFileSync('Dockerfile', 'utf8')

// Verify Dockerfile accepts APP_BASE_URL, NEXT_PUBLIC_APP_URL, and NEXT_PUBLIC_SERVER_URL as ARGs
assert.ok(dockerfile.includes('ARG NEXT_PUBLIC_APP_URL'), 'Dockerfile must accept NEXT_PUBLIC_APP_URL as build argument')
assert.ok(dockerfile.includes('ARG APP_BASE_URL'), 'Dockerfile must accept APP_BASE_URL as build argument')
assert.ok(dockerfile.includes('ARG NEXT_PUBLIC_SERVER_URL'), 'Dockerfile must accept NEXT_PUBLIC_SERVER_URL as build argument')

// Verify the ARGs are used in ENV (so they can be overridden at build time)
assert.ok(dockerfile.includes('ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}'), 'Dockerfile must pass NEXT_PUBLIC_APP_URL ARG to ENV')
assert.ok(dockerfile.includes('ENV APP_BASE_URL=${APP_BASE_URL}'), 'Dockerfile must pass APP_BASE_URL ARG to ENV')
assert.ok(dockerfile.includes('ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}'), 'Dockerfile must pass NEXT_PUBLIC_SERVER_URL ARG to ENV')

// Verify importmap generation happens in builder and cannot be skipped
assert.ok(
  dockerfile.includes('pnpm generate:importmap'),
  'Dockerfile must call pnpm generate:importmap directly (not through a fallback script)'
)

// Verify the importmap generation is before build
const generateIdx = dockerfile.indexOf('pnpm generate:importmap')
const buildIdx = dockerfile.indexOf('pnpm run build')
assert.ok(generateIdx > 0, 'Dockerfile must contain pnpm generate:importmap')
assert.ok(buildIdx > generateIdx, 'Dockerfile must generate importmap before building')

// Verify no unsafe fallback script exists
assert.ok(
  !dockerfile.includes('generate-importmap-safe.sh'),
  'Dockerfile must not use unsafe fallback script (build must fail if importmap generation fails)'
)

// Verify staging URL is the default (staging-first model — not production)
assert.ok(
  dockerfile.includes('ARG NEXT_PUBLIC_APP_URL=https://staging.jpvbootcamp.com'),
  'Staging URL must be the build ARG default — production URL must not be the default'
)

// Verify production URL is not baked in as a default for any URL ARG
assert.ok(
  !dockerfile.match(/ARG NEXT_PUBLIC_APP_URL=https:\/\/jpvbootcamp\.com[^/]/),
  'Production URL must not be the ARG default for NEXT_PUBLIC_APP_URL'
)
assert.ok(
  !dockerfile.match(/ARG APP_BASE_URL=https:\/\/jpvbootcamp\.com[^/]/),
  'Production URL must not be the ARG default for APP_BASE_URL'
)
assert.ok(
  !dockerfile.match(/ARG NEXT_PUBLIC_SERVER_URL=https:\/\/jpvbootcamp\.com[^/]/),
  'Production URL must not be the ARG default for NEXT_PUBLIC_SERVER_URL'
)

console.log('✓ docker-staging-urls.test.ts passed: Staging builds default to staging URLs, production URLs excluded')
