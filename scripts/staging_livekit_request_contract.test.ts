import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const helper = fs.readFileSync(
	path.join(repoRoot, 'scripts/staging-livekit-bunny-test.mts'),
	'utf8',
)
const route = fs.readFileSync(
	path.join(repoRoot, 'src/app/api/livekit/token/route.ts'),
	'utf8',
)

assert.match(
	helper,
	/body\s*=\s*JSON\.stringify\(\{\s*sessionId:/s,
	'LiveKit staging smoke must send the current { sessionId } request body',
)
assert.doesNotMatch(
	helper,
/(?:courseId|moduleId|lessonId|role)\s*:/,
	'LiveKit staging smoke must not send the removed course/role contract',
)
assert.match(
	helper,
	/const passed = status === 401/,
	'LiveKit staging smoke must require the unauthenticated auth-boundary response',
)
assert.match(
	route,
	/let body: \{ sessionId\?: string \}/,
	'LiveKit token route must parse the sessionId request contract',
)
assert.match(
	route,
	/const sessionId = body\.sessionId\?\.trim\(\)/,
	'LiveKit token route must validate sessionId',
)

console.log('✅ LiveKit staging request contract is aligned')
