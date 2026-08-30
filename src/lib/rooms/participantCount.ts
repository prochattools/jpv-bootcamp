import { RoomServiceClient } from 'livekit-server-sdk'

import { getLiveKitConfig } from '@/lib/livekit-config'

function httpHost(wsUrl: string): string {
  if (wsUrl.startsWith('wss://')) return `https://${wsUrl.slice('wss://'.length)}`
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice('ws://'.length)}`
  return wsUrl
}

/** Returns null when LiveKit is not configured or its participant API is unavailable. */
export async function getRoomParticipantCount(roomName: string): Promise<number | null> {
  try {
    const config = getLiveKitConfig()
    const service = new RoomServiceClient(httpHost(config.wsUrl), config.apiKey, config.apiSecret)
    const participants = await service.listParticipants(roomName)
    return participants.length
  } catch (error) {
    console.warn('room_participant_count_unavailable', {
      roomName,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
