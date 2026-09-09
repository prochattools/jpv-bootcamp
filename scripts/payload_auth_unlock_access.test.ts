import assert from 'node:assert/strict'

import { PayloadUsers } from '../src/collections/PayloadUsers'
import { PayloadMembers } from '../src/collections/members/Members'

type RequestUser = {
  id: string
  collection: 'payload_users' | 'payload_members'
}

function request(user?: RequestUser) {
  return { user } as never
}

const userUnlock = PayloadUsers.access?.unlock
const memberUnlock = PayloadMembers.access?.unlock

assert.equal(typeof userUnlock, 'function', 'administrator unlock access must be configured')
assert.equal(typeof memberUnlock, 'function', 'member unlock access must be configured')

async function testUnlockAccess(): Promise<void> {
  for (const [name, unlock] of [
    ['administrator', userUnlock],
    ['member', memberUnlock],
  ] as const) {
    assert.equal(await unlock!({ req: request() }), false, `${name} unlock must deny anonymous requests`)
    assert.equal(
      await unlock!({ req: request({ id: 'member-1', collection: 'payload_members' }) }),
      false,
      `${name} unlock must deny member requests`,
    )
    assert.equal(
      await unlock!({ req: request({ id: 'admin-1', collection: 'payload_users' }) }),
      true,
      `${name} unlock must allow administrator requests`,
    )
  }
}

testUnlockAccess()
  .then(() => console.log('payload_auth_unlock_access.test.ts passed'))
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
