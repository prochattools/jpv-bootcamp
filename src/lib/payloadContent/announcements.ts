import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import { createMemberNotificationIfMissing } from '@/lib/payloadCourse/memberNotifications'

export type AnnouncementRecipient = { memberId: string; email: string; displayName: string }

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

export async function activeMemberRecipients(payload: PayloadCourseWriteAPI, memberIds?: string[]): Promise<AnnouncementRecipient[]> {
  const members = memberIds
    ? await Promise.all(memberIds.map((memberId) => payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true }).catch((): null => null)))
    : (await payload.find({ collection: 'payload_members', where: { accountStatus: { equals: 'active' } }, limit: 2000, depth: 0, overrideAccess: true })).docs
  const recipients: AnnouncementRecipient[] = []
  for (const member of members as Array<PayloadDocument | null>) {
    if (!member || member.accountStatus !== 'active' || !member.emailVerifiedAt) continue
    const email = text(member.email)
    if (!email) continue
    const profiles = await payload.find({ collection: 'payload_member_profiles', where: { member: { equals: String(member.id) } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as PayloadDocument[] }))
    recipients.push({ memberId: String(member.id), email, displayName: text(profiles.docs[0]?.displayName) ?? email.split('@')[0] ?? 'Member' })
  }
  return recipients
}

export async function notifyAnnouncementRecipients(
  payload: PayloadCourseWriteAPI,
  post: PayloadDocument,
  body: string,
  baseUrl: string,
): Promise<number> {
  const audience = post.audience === 'selected' ? 'selected' : 'all'
  const memberIds = audience === 'selected' && Array.isArray(post.targetMemberIds) ? post.targetMemberIds.map((value) => String(value)) : undefined
  const recipients = await activeMemberRecipients(payload, memberIds)
  let created = 0
  for (const recipient of recipients) {
    const { created: emailCreated } = await queueAndAttemptEmailEvent(payload, {
      toEmail: recipient.email,
      templateKey: 'portal-announcement',
      dedupeKey: `portal-announcement:${post.id}:${recipient.memberId}`,
      displayName: `Portal announcement -> ${recipient.email}`,
      metadata: {
        displayName: recipient.displayName,
        announcementTitle: text(post.title) ?? 'JPV Bootcamp update',
        announcementBody: body,
        announcementUrl: `${baseUrl.replace(/\/$/, '')}/portal/posts/${text(post.slug) ?? post.id}`,
      },
    })
    if (emailCreated) created++
    try {
      await createMemberNotificationIfMissing(payload, {
        memberId: recipient.memberId,
        type: 'announcement',
        title: `published ${text(post.title) ?? 'a new update'}`,
        href: `/portal/posts/${text(post.slug) ?? post.id}`,
      })
    } catch {
      // Notification delivery is retried by the email/event workers and never
      // invalidates the already-published announcement.
    }
  }
  return created
}
