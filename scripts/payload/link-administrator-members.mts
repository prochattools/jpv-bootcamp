import config from '@payload-config'
import { getPayload } from 'payload'

import { ensureAdministratorMemberIdentity } from '../../src/lib/auth/adminMemberIdentity'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  if (apply && process.env.ADMIN_MEMBER_IDENTITY_APPLY !== 'true') {
    throw new Error('set ADMIN_MEMBER_IDENTITY_APPLY=true before applying administrator member links')
  }

  const payload = await getPayload({ config })
  const administrators: typeof payload extends { find: (...args: any[]) => Promise<infer R> } ? R['docs'] : never = []
  let page = 1
  do {
    const result = await payload.find({
      collection: 'payload_users',
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    })
    administrators.push(...result.docs)
    if (!result.hasNextPage) break
    page += 1
  } while (page <= 1000)

  const rows: Array<{ administratorId: string; email: string; status: string; memberId?: string }> = []
  for (const administrator of administrators) {
    const email = typeof administrator.email === 'string' ? administrator.email.trim().toLowerCase() : ''
    if (!email) continue
    if (!apply) {
      rows.push({
        administratorId: String(administrator.id),
        email,
        status: administrator.portalMember ? 'already_linked' : 'would_link',
        ...(administrator.portalMember ? { memberId: String(typeof administrator.portalMember === 'object' ? administrator.portalMember.id : administrator.portalMember) } : {}),
      })
      continue
    }
    const identity = await ensureAdministratorMemberIdentity(payload, administrator)
    rows.push({
      administratorId: String(administrator.id),
      email,
      status: identity ? 'linked' : 'skipped_missing_email',
      ...(identity ? { memberId: String(identity.member.id) } : {}),
    })
  }

  console.log(JSON.stringify({ apply, administrators: rows }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'unknown_error')
  process.exitCode = 1
})
