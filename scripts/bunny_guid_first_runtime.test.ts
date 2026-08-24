import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PAYLOAD_MIGRATION_NAMES } from '../src/lib/payloadMigrationRegistry'

const bunnyApi = readFileSync('src/lib/bunny-api.ts', 'utf8')
const collection = readFileSync('src/collections/PayloadBunnyVideo.ts', 'utf8')
const createRoute = readFileSync('src/app/api/admin/bunny/create-video/route.ts', 'utf8')
const webhook = readFileSync('src/app/api/webhook/bunny/route.ts', 'utf8')

assert.match(bunnyApi, /const BUNNY_STREAM_API_BASE = 'https:\/\/video\.bunnycdn\.com'/)
assert.match(bunnyApi, /guid: string/)
assert.match(bunnyApi, /videoGuid: string/)
assert.doesNotMatch(bunnyApi, /videoId: number/)
assert.match(bunnyApi, /\/library\/\$\{encodeURIComponent\(libraryId\)\}\/videos/)
assert.match(bunnyApi, /getBunnyPlaybackToken is deprecated/)

const videoIdField = collection.match(/name: 'videoId'[\s\S]*?\n\t\t},/)?.[0] ?? ''
const videoGuidField = collection.match(/name: 'videoGuid'[\s\S]*?\n\t\t},/)?.[0] ?? ''
assert.ok(videoIdField)
assert.doesNotMatch(videoIdField, /required: true/)
assert.match(videoIdField, /Legacy Bunny Video ID/)
assert.ok(videoGuidField)
assert.match(videoGuidField, /unique: true/)
assert.match(videoGuidField, /canonical/)

assert.match(createRoute, /videoGuid: bunnyVideo\.videoGuid/)
assert.doesNotMatch(createRoute, /videoId: bunnyVideo\.videoId/)
assert.match(createRoute, /videoId: bunnyVideo\.videoGuid/)
assert.match(createRoute, /uploadToken: null/)

assert.match(webhook, /VideoId\?: number/)
assert.match(webhook, /const videoGuid = payload\.VideoGuid\?\.trim\(\) \|\| null/)
assert.match(webhook, /\{ videoGuid: \{ equals: videoGuid \} \}/)
assert.match(webhook, /where: identifierWhere as any/)
assert.doesNotMatch(webhook, /videoId: payload\.VideoId/)

assert.equal(PAYLOAD_MIGRATION_NAMES.slice(0, 35).length, 35)
assert.equal(PAYLOAD_MIGRATION_NAMES.slice(0, 35).at(-1), '20260818_140100_portal_settings')

console.log('Bunny GUID-first runtime contract: PASS')
