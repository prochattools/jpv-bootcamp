import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const collection = read('src/collections/PayloadLiveSession.ts')
const categories = read('src/collections/PayloadRoomCategories.ts')
const access = read('src/collections/PayloadRoomAccess.ts')
const lifecycle = read('src/lib/liveSessions/sessionLifecycle.ts')
const canonicalApi = read('src/app/api/portal/rooms/route.ts')
const canonicalDetailApi = read('src/app/api/portal/rooms/[id]/route.ts')
const legacyApi = read('src/app/api/portal/live-sessions/route.ts')
const roomsPage = read('src/app/(frontend)/portal/rooms/page.tsx')
const roomsAdmin = read('src/components/portal/PortalRoomsAdmin.tsx')
const migration = read('src/migrations/20260830_090000_member_portal_rooms.ts')

assert.match(collection, /value: 'groups'/)
assert.match(collection, /name: 'categories'/)
assert.match(collection, /name: 'archived'/)
assert.match(access, /eventKey.*unique: true/)
assert.match(categories, /Categories do not grant access/)
assert.match(lifecycle, /completed.*cancelled/)
assert.match(lifecycle, /archiveOnlyUpdate/)
assert.match(canonicalApi, /export async function GET/)
assert.match(canonicalApi, /export async function POST/)
assert.match(canonicalDetailApi, /export async function PATCH/)
assert.match(canonicalDetailApi, /export async function DELETE/)
assert.match(legacyApi, /Compatibility adapter/)
assert.match(roomsPage, /AdminGate/)
assert.match(roomsPage, /listMemberRooms/)
assert.match(roomsAdmin, /createRoomAction/)
assert.match(roomsAdmin, /Participants unknown/)
assert.match(migration, /payload_room_access/)
assert.match(migration, /payload_room_categories/)
assert.match(migration, /rollback_blocked_populated_data/)

console.log('rooms-contract.test.ts passed')
