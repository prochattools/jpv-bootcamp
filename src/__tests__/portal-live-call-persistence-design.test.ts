import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const provider = readFileSync(resolve(root, 'src/components/portal/PersistentLiveCallProvider.tsx'), 'utf8')
const callStage = readFileSync(resolve(root, 'src/components/portal/LiveCallRoom.tsx'), 'utf8')

describe('persistent portal LiveKit call contract', () => {
  it('keeps the Room context in the portal shell instead of route-owned LiveKitRoom markup', () => {
    expect(provider).toContain('<RoomContext.Provider value={room}>')
    expect(provider).toContain("data-live-call-persistent='true'")
    expect(callStage).not.toContain('<LiveKitRoom')
  })

  it('makes explicit leave the member-facing call-ending action', () => {
    expect(callStage).toContain('Use Leave to end your connection.')
    expect(provider).toContain('Leave</button>')
  })
})
