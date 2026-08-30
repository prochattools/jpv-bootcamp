import type { RoomAudience } from '@/lib/rooms/audience'

export type RoomLiveKitPermissionInput = {
  isHost: boolean
  audience: RoomAudience
  courseSession: boolean
  spaceSession: boolean
}

export function roomLiveKitPermissions(input: RoomLiveKitPermissionInput): {
  canPublish: boolean
  canPublishData: true
  canSubscribe: true
  roomAdmin: boolean
} {
  return {
    // Legacy course sessions retain host-only publishing. New unlinked,
    // group, selected, and all-member Rooms are two-way video rooms.
    canPublish: input.isHost || input.spaceSession || (!input.courseSession && input.audience !== 'enrolled'),
    canPublishData: true,
    canSubscribe: true,
    roomAdmin: input.isHost,
  }
}
