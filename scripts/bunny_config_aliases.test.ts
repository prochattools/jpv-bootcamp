import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const bunnyApi = readFileSync('src/lib/bunny-api.ts', 'utf8')
const readiness = readFileSync('scripts/release/providerReadiness.ts', 'utf8')
const createRoute = readFileSync('src/app/api/admin/bunny/create-video/route.ts', 'utf8')

for (const source of [bunnyApi, readiness, createRoute]) {
  assert.match(source, /BUNNY_STREAM_API_KEY/)
  assert.match(source, /BUNNY_STREAM_LIBRARY_ID/)
}

assert.match(bunnyApi, /process\.env\.BUNNY_API_KEY \|\| process\.env\.BUNNY_STREAM_API_KEY/)
assert.match(bunnyApi, /process\.env\.BUNNY_LIBRARY_ID \|\| process\.env\.BUNNY_STREAM_LIBRARY_ID/)
assert.match(readiness, /Boolean\(apiKey && libraryId\)/)
assert.match(readiness, /BUNNY_API_KEY\|BUNNY_STREAM_API_KEY/)
assert.match(readiness, /BUNNY_LIBRARY_ID\|BUNNY_STREAM_LIBRARY_ID/)

console.log('Bunny configuration alias contract: PASS')
