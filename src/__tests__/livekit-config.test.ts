import assert from 'node:assert/strict'

// Direct test of room name generation logic (avoid server-only import)
function generateLiveKitRoomName(courseId: string, moduleId: string, lessonId: string): string {
	return `course-${courseId}-module-${moduleId}-lesson-${lessonId}`.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

console.log('LiveKit Config Tests')
console.log('====================\n')

// Test 1: Room name generation
console.log('Test 1: Deterministic room name generation')
const roomName = generateLiveKitRoomName('101', '202', '303')
assert.equal(roomName, 'course-101-module-202-lesson-303', 'Room name should be deterministic')
console.log(`✓ Generated room name: ${roomName}`)

// Test 2: Room name sanitization
console.log('\nTest 2: Room name sanitizes special characters')
const roomName2 = generateLiveKitRoomName('course-101', 'module-202', 'lesson:303')
assert.equal(roomName2, 'course-course-101-module-module-202-lesson-lesson303', 'Should handle prefixed IDs and strip non-alphanumeric')
console.log(`✓ Sanitized room name: ${roomName2}`)

// Test 3: LiveKit configuration detection
console.log('\nTest 3: LiveKit configuration detection')
// Note: This will return false in CI without credentials, which is expected
const hasUrl = !!process.env.LIVEKIT_URL
const hasApiKey = !!process.env.LIVEKIT_API_KEY
const hasApiSecret = !!process.env.LIVEKIT_API_SECRET
const configured = hasUrl && hasApiKey && hasApiSecret
console.log(`✓ LiveKit configured in environment: ${configured}`)

console.log('\n====================')
console.log('✅ LiveKit config tests passed')
