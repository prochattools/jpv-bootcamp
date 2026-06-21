import type { Access, AccessArgs, PayloadRequest, Where } from 'payload'

type RequestUser = {
  id?: string | number
  collection?: string
  roles?: string[]
}

function getRequestUser(req: PayloadRequest): RequestUser | null {
  return (req.user as RequestUser | null | undefined) ?? null
}

export function isPayloadAdminRequest(req: PayloadRequest): boolean {
  const user = getRequestUser(req)
  return Boolean(user && user.collection === 'payload_users')
}

export function isPayloadMemberRequest(req: PayloadRequest): boolean {
  const user = getRequestUser(req)
  return Boolean(user && user.collection === 'payload_members')
}

export function getAuthenticatedUserId(req: PayloadRequest): string | null {
  const user = getRequestUser(req)
  if (!user?.id) return null
  return String(user.id)
}

export const requirePayloadAdmin: Access = ({ req }) => isPayloadAdminRequest(req)

export const denyPublicWrite: Access = ({ req }) => isPayloadAdminRequest(req)

export const requirePayloadAdminOrMemberSelf: Access = ({ id, req }: AccessArgs) => {
  if (isPayloadAdminRequest(req)) return true

  const userId = getAuthenticatedUserId(req)
  if (!userId || !isPayloadMemberRequest(req)) return false

  if (id) return String(id) === userId

  return {
    id: {
      equals: userId,
    },
  } as Where
}

export function requirePayloadAdminOrRelatedMember(memberField = 'member'): Access {
  return ({ req }) => {
    if (isPayloadAdminRequest(req)) return true

    const userId = getAuthenticatedUserId(req)
    if (!userId || !isPayloadMemberRequest(req)) return false

    return {
      [memberField]: {
        equals: userId,
      },
    } as Where
  }
}

export const allowPublishedPublicRead: Access = ({ req }) => {
  if (isPayloadAdminRequest(req)) return true

  return {
    status: {
      equals: 'published',
    },
  } as Where
}

export const adminOnlyCollectionAccess = {
  admin: ({ req }: { req: PayloadRequest }) => isPayloadAdminRequest(req),
  create: requirePayloadAdmin,
  read: requirePayloadAdmin,
  update: requirePayloadAdmin,
  delete: requirePayloadAdmin,
}
