import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('scripts/migration/legacyBunnyReadOnly.ts', 'utf8')

assert.match(source, /https:\/\/video\.bunnycdn\.com\/library\/\$\{encodeURIComponent\(config\.libraryId\)\}\/videos\/\$\{encodeURIComponent\(videoGuid\)\}/)
assert.match(source, /fetchImpl\(url, \{[\s\S]*?method: 'GET'/)
assert.match(source, /headers: \{ AccessKey: config\.apiKey \}/)
assert.match(source, /videoLibraryId: number/)
assert.match(source, /guid: string/)
assert.doesNotMatch(source, /videoId: number/)
assert.doesNotMatch(source, /method: 'POST'/)
assert.match(source, /env\.BUNNY_API_KEY \|\| env\.BUNNY_STREAM_API_KEY/)
assert.match(source, /env\.BUNNY_LIBRARY_ID \|\| env\.BUNNY_STREAM_LIBRARY_ID/)

console.log('Bunny migration verifier GET-only contract: PASS')
