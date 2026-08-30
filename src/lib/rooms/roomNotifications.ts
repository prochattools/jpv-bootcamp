import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import { createMemberNotificationIfMissing } from '@/lib/payloadCourse/memberNotifications'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { roomAccessEventKey } from '@/lib/rooms/roomAccess'
import type { RoomAudienceMember } from '@/lib/rooms/audience'

export const ROOM_INVITATION_EVENT = 'room_invitation'

export function roomUrl(roomId: string | number): string {
  return `/portal/rooms/${encodeURIComponent(String(roomId))}`
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

export async function notifyRoomMember(
  payload: PayloadCourseWriteAPI,
  room: PayloadDocument,
  member: RoomAudienceMember,
): Promise<{ emailCreated: boolean; notificationCreated: boolean }> {
  const roomId = String(room.id)
  const eventKey = roomAccessEventKey(roomId, member.memberId)
  const title = text(room.title) ?? 'Room'
  const href = roomUrl(roomId)
  const email = await queueAndAttemptEmailEvent(payload, {
    toEmail: member.email,
    templateKey: 'room-invitation',
    dedupeKey: `${eventKey}:email`,
    displayName: `Room invitation -> ${member.email}`,
    metadata: {
      displayName: member.displayName,
      roomTitle: title,
      scheduledAt: text(room.scheduledAt) ?? '',
      roomUrl: `${getPublicBaseUrl()}${href}`,
      portalUrl: `${getPublicBaseUrl()}/portal/rooms`,
    },
  })

  const notification = await createMemberNotificationIfMissing(payload, {
    memberId: member.memberId,
    type: ROOM_INVITATION_EVENT,
    title: `You are invited to ${title}`,
    href,
    eventKey,
  })

  return {
    emailCreated: email.created,
    notificationCreated: Boolean(notification),
  }
}

export function roomCreatorEventKey(roomId: string | number, adminId: string | number): string {
  return `room-created:${String(roomId)}:${String(adminId)}`
}

export async function notifyRoomCreator(
  payload: PayloadCourseWriteAPI,
  room: PayloadDocument,
  input: { adminId: string; adminEmail?: string | null },
): Promise<{ emailCreated: boolean; notificationCreated: boolean }> {
  const roomId = String(room.id)
  const title = text(room.title) ?? 'Room'
  const href = roomUrl(roomId)
  const eventKey = roomCreatorEventKey(roomId, input.adminId)
  let emailCreated = false
  if (input.adminEmail?.trim()) {
    const email = await queueAndAttemptEmailEvent(payload, {
      toEmail: input.adminEmail.trim(),
      templateKey: 'room-created',
      dedupeKey: `${eventKey}:email`,
      displayName: `Room created acknowledgement -> ${input.adminEmail.trim()}`,
      metadata: {
        displayName: 'Administrator',
        roomTitle: title,
        scheduledAt: text(room.scheduledAt) ?? '',
        roomUrl: `${getPublicBaseUrl()}${href}`,
        portalUrl: `${getPublicBaseUrl()}/portal/rooms`,
      },
    })
    emailCreated = email.created
  }

  const existing = await payload.find({
    collection: 'payload_admin_notifications',
    where: { eventKey: { equals: eventKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return { emailCreated, notificationCreated: false }

  let notificationCreated = false
  try {
    await payload.create({
      collection: 'payload_admin_notifications',
      data: {
        title: `Room created: ${title}`,
        notificationType: 'community',
        severity: 'info',
        status: 'unread',
        body: `Room “${title}” was created and its audience reconciliation completed.`,
        relatedCollection: 'live_sessions',
        relatedDocumentId: roomId,
        eventKey,
        metadata: { href, adminId: input.adminId },
      },
      overrideAccess: true,
    })
    notificationCreated = true
  } catch (error) {
    const raced = await payload.find({
      collection: 'payload_admin_notifications',
      where: { eventKey: { equals: eventKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (raced.docs.length === 0) throw error
    notificationCreated = false
  }
  return { emailCreated, notificationCreated }
}
