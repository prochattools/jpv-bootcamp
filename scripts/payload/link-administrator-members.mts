import config from '@payload-config'
import { getPayload } from 'payload'

import {
  ensureAdministratorMemberIdentity,
  resolveAdministratorMemberIdentity,
} from '../../src/lib/auth/adminMemberIdentity'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  if (apply && process.env.ADMIN_MEMBER_IDENTITY_APPLY !== 'true') {
    throw new Error('set ADMIN_MEMBER_IDENTITY_APPLY=true before applying administrator member links')
  }

  // This is a one-shot data reconciliation. Do not run application startup
  // hooks (including staging auto-provisioning) while opening Payload.
  console.error('[administrator-backfill] initializing Payload without onInit hooks')
  const payload = await getPayload({ config, disableOnInit: true })
  console.error('[administrator-backfill] Payload initialized')
  try {
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
      console.error(`[administrator-backfill] read administrator page ${page} (${result.docs.length} records)`)
      if (!result.hasNextPage) break
      page += 1
    } while (page <= 1000)

    const rows: Array<{ administratorId: string; email: string; status: string; memberId?: string }> = []
    for (const administrator of administrators) {
      const email = typeof administrator.email === 'string' ? administrator.email.trim().toLowerCase() : ''
      if (!email) {
        rows.push({
          administratorId: String(administrator.id),
          email: '',
          status: 'skipped_missing_email',
        })
        continue
      }
      if (!apply) {
        const resolution = await resolveAdministratorMemberIdentity(payload, administrator)
        const status = resolution.source === 'ambiguous'
          ? 'ambiguous'
          : resolution.source === 'invalid'
            ? 'invalid'
            : resolution.member
              ? resolution.source === 'linked'
                ? 'already_linked'
                : 'matched_by_email'
              : 'would_link'
        rows.push({
          administratorId: String(administrator.id),
          email,
          status,
          ...(resolution.member ? { memberId: String(resolution.member.id) } : {}),
        })
        continue
      }
      const resolution = await resolveAdministratorMemberIdentity(payload, administrator)
      if (resolution.source === 'ambiguous' || resolution.source === 'invalid') {
        rows.push({
          administratorId: String(administrator.id),
          email,
          status: `skipped_${resolution.source}`,
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
  } finally {
    // Payload's postgres adapter owns a node-postgres pool. Close it after the
    // one-shot reconciliation so CI can finish cleanly instead of waiting on
    // idle sockets indefinitely.
    await payload.db.pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'unknown_error')
  process.exitCode = 1
})
