import { readBoundedJsonObject } from '@/lib/auth/accountActionRouteSafety'

import type { InviteMemberInput, InviteMemberResult } from './inviteMember'

type InvitationAdministrator = {
  id: string | number
  collection: string
}

export type MemberInvitationHttpDependencies = {
  authenticate(request: Request): Promise<InvitationAdministrator | null>
  invite(input: InviteMemberInput): Promise<InviteMemberResult>
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function handleMemberInvitationRequest(
  request: Request,
  dependencies: MemberInvitationHttpDependencies,
): Promise<Response> {
  const administrator = await dependencies.authenticate(request)
  if (!administrator?.id || administrator.collection !== 'payload_users') {
    return json({ ok: false, error: 'forbidden' }, 403)
  }

  const parsed = await readBoundedJsonObject(request)
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, parsed.status)

  const email = parsed.body.email
  const displayName = parsed.body.displayName
  if (typeof email !== 'string' || email.trim().length < 3 || email.length > 320) {
    return json({ ok: false, error: 'invalid_email' }, 400)
  }
  if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
    return json({ ok: false, error: 'invalid_display_name' }, 400)
  }

  const result = await dependencies.invite({
    administratorId: administrator.id,
    email,
    displayName: typeof displayName === 'string' ? displayName.slice(0, 80) : null,
  })
  if (result.ok === false) {
    return json({ ok: false, error: result.error }, result.error === 'invalid_email' ? 400 : 409)
  }

  return json({
    ok: true,
    memberId: result.memberId,
    created: result.created,
    emailQueued: result.emailQueued,
    delivery: result.delivery,
  })
}
