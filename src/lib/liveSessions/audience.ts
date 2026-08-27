import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import { liveSessionRelationshipId } from '@/lib/liveSessions/sessionLifecycle'
import { createMemberNotificationIfMissing } from '@/lib/payloadCourse/memberNotifications'

export type LiveSessionRecipient = {
  memberId: string
  email: string
  displayName: string
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function uniqueIds(values: unknown[]): string[] {
  return [...new Set(values.map(liveSessionRelationshipId).filter((value): value is string => Boolean(value)))]
}

async function memberRecipients(payload: PayloadCourseWriteAPI, memberIds: string[]): Promise<LiveSessionRecipient[]> {
  const recipients: LiveSessionRecipient[] = []
  for (const memberId of [...new Set(memberIds)]) {
    const member = await payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true }).catch((): null => null) as PayloadDocument | null
    if (!member || member.accountStatus !== 'active' || !member.emailVerifiedAt) continue
    const email = text(member.email)
    if (!email) continue
    const profiles = await payload.find({ collection: 'payload_member_profiles', where: { member: { equals: memberId } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as PayloadDocument[] }))
    recipients.push({
      memberId,
      email,
      displayName: text(profiles.docs[0]?.displayName) ?? email.split('@')[0] ?? 'Member',
    })
  }
  return recipients
}

export async function resolveLiveSessionRecipients(
  payload: PayloadCourseWriteAPI,
  session: PayloadDocument,
): Promise<LiveSessionRecipient[]> {
  const audience = session.audience === 'all' || session.audience === 'selected' ? session.audience : 'enrolled'
  if (audience === 'selected') return memberRecipients(payload, uniqueIds(Array.isArray(session.targetMemberIds) ? session.targetMemberIds : []))

  if (audience === 'all') {
    const members = await payload.find({ collection: 'payload_members', where: { accountStatus: { equals: 'active' } }, limit: 2000, depth: 0, overrideAccess: true })
    return memberRecipients(payload, members.docs.map((member) => String(member.id)))
  }

  const courseId = liveSessionRelationshipId(session.course)
  const spaceId = liveSessionRelationshipId(session.space)
  const ids: string[] = []
  if (courseId) {
    const enrollments = await payload.find({ collection: 'payload_course_enrollments', where: { and: [{ course: { equals: courseId } }, { status: { equals: 'active' } }] }, limit: 2000, depth: 0, overrideAccess: true })
    ids.push(...enrollments.docs.map((enrollment) => liveSessionRelationshipId(enrollment.member)).filter((value): value is string => Boolean(value)))
  }
  if (spaceId) {
    const memberships = await payload.find({ collection: 'payload_space_memberships', where: { and: [{ space: { equals: spaceId } }, { status: { equals: 'active' } }] }, limit: 2000, depth: 0, overrideAccess: true })
    ids.push(...memberships.docs.map((membership) => liveSessionRelationshipId(membership.member)).filter((value): value is string => Boolean(value)))
  }
  return memberRecipients(payload, ids)
}

export async function notifyLiveSessionRecipients(
  payload: PayloadCourseWriteAPI,
  session: PayloadDocument,
  baseUrl: string,
): Promise<number> {
  const recipients = await resolveLiveSessionRecipients(payload, session)
  let created = 0
  for (const recipient of recipients) {
    const sessionId = String(session.id)
    const { created: emailCreated } = await queueAndAttemptEmailEvent(payload, {
      toEmail: recipient.email,
      templateKey: 'live-session-invitation',
      dedupeKey: `live-session-invitation:${sessionId}:${recipient.memberId}`,
      displayName: `Live session invitation -> ${recipient.email}`,
      metadata: {
        displayName: recipient.displayName,
        sessionTitle: text(session.title) ?? 'Live session',
        scheduledAt: text(session.scheduledAt) ?? '',
        sessionUrl: `${baseUrl.replace(/\/$/, '')}/portal/live-sessions/${sessionId}`,
      },
    })
    if (emailCreated) created++
    try {
      const sessionUrl = `/portal/live-sessions/${sessionId}`
      await createMemberNotificationIfMissing(payload, {
        memberId: recipient.memberId,
        type: 'live_session',
        title: `invited you to ${text(session.title) ?? 'a live session'}`,
        href: sessionUrl,
      })
    } catch {
      // Email and session creation remain authoritative if one notification fails.
    }
  }
  return created
}
