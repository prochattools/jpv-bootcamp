import { RoomServiceClient } from 'livekit-server-sdk'

import { getLiveKitConfig } from '@/lib/livekit-config'

function httpHost(wsUrl: string): string {
  if (wsUrl.startsWith('wss://')) return `https://${wsUrl.slice('wss://'.length)}`
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice('ws://'.length)}`
  return wsUrl
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * LiveKit creates a room lazily when the first participant joins. A live
 * Payload Room can therefore legitimately have no corresponding LiveKit room
 * yet; that state represents zero participants, not an unavailable service.
 */
export function isLiveKitRoomNotFoundError(error: unknown): boolean {
  return errorMessage(error).toLowerCase().includes('requested room does not exist')
}

/** Returns null when LiveKit is not configured or its participant API is unavailable. */
export async function getRoomParticipantCount(roomName: string): Promise<number | null> {
  try {
    const config = getLiveKitConfig()
    const service = new RoomServiceClient(httpHost(config.wsUrl), config.apiKey, config.apiSecret)
    const participants = await service.listParticipants(roomName)
    return participants.length
  } catch (error) {
    if (isLiveKitRoomNotFoundError(error)) return 0

    console.warn('room_participant_count_unavailable', {
      roomName,
      error: errorMessage(error),
    })
    return null
  }
}
