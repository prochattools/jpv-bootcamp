import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'

type MemberNotificationInput = {
  memberId: string
  type: string
  title: string
  href: string
  eventKey?: string
}

export async function createMemberNotificationIfMissing(
  payload: PayloadCourseWriteAPI,
  input: MemberNotificationInput,
): Promise<PayloadDocument | null> {
  const existing = await payload.find({
    collection: 'payload_member_notifications',
    where: input.eventKey
      ? { eventKey: { equals: input.eventKey } }
      : {
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

  try {
    return await payload.create({
      collection: 'payload_member_notifications',
      data: {
        member: input.memberId,
        type: input.type,
        actorName: 'JPV Bootcamp',
        title: input.title,
        href: input.href,
        eventKey: input.eventKey,
        read: false,
      },
      overrideAccess: true,
    })
  } catch (error) {
    if (!input.eventKey) throw error
    const raced = await payload.find({
      collection: 'payload_member_notifications',
      where: { eventKey: { equals: input.eventKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (raced.docs[0]) return raced.docs[0]
    throw error
  }
}
