import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const access = read('src/lib/auth/requirePortalAccess.ts')
const admin = read('src/lib/auth/requirePortalAdmin.ts')
const collectionRoute = read('src/app/api/portal/rooms/route.ts')
const detailRoute = read('src/app/api/portal/rooms/[id]/route.ts')

assert.match(access, /redirectOnFailure\?: boolean/)
assert.match(access, /new PortalAdminActionError\('unauthorized', 'Please sign in and try again\.'\)/)
assert.match(admin, /requirePortalAccess\(requestedPath, options\)/)
assert.equal((collectionRoute.match(/requirePortalAdmin\('\/portal\/rooms', \{ redirectOnFailure: false \}\)/g) ?? []).length, 2)
assert.equal((detailRoute.match(/requirePortalAdmin\('\/portal\/rooms', \{ redirectOnFailure: false \}\)/g) ?? []).length, 3)

console.log('rooms-api-auth-contract.test.ts passed')
