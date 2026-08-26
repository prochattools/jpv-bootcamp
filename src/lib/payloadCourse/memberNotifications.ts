import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'

type MemberNotificationInput = {
  memberId: string
  type: string
  title: string
  href: string
}

export async function createMemberNotificationIfMissing(
  payload: PayloadCourseWriteAPI,
  input: MemberNotificationInput,
): Promise<PayloadDocument | null> {
  const existing = await payload.find({
    collection: 'payload_member_notifications',
    where: {
      and: [
        { member: { equals: input.memberId } },
        { type: { equals: input.type } },
        { title: { equals: input.title } },
        { href: { equals: input.href } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0]

  return payload.create({
    collection: 'payload_member_notifications',
    data: {
      member: input.memberId,
      type: input.type,
      actorName: 'JPV Bootcamp',
      title: input.title,
      href: input.href,
      read: false,
    },
    overrideAccess: true,
  })
}
