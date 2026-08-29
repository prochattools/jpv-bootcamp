import config from '@payload-config'
import { Client } from 'pg'
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
  const memberLookupClient = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  })
  let memberLookupConnected = false
  try {
    console.error('[administrator-backfill] opening lookup client')
    await memberLookupClient.connect()
    memberLookupConnected = true
    await memberLookupClient.query("SET statement_timeout = '15000ms'")
    await memberLookupClient.query("SET lock_timeout = '5000ms'")
    console.error('[administrator-backfill] lookup client connected')
    // This is a small, bounded collection. Avoid Payload's paginated find
    // path here: it performs an additional count/page query that can remain
    // open on the staging database even after the first page has returned.
    const result = await payload.find({
      collection: 'payload_users',
      depth: 0,
      overrideAccess: true,
      pagination: false,
    })
    const administrators = result.docs
    console.error(`[administrator-backfill] read administrators (${administrators.length} records)`)
    const identityPayload = {
      ...payload,
      db: { pool: memberLookupClient },
    }

    const rows: Array<{ administratorId: string; email: string; status: string; memberId?: string }> = []
    for (const administrator of administrators) {
      const email = typeof administrator.email === 'string' ? administrator.email.trim().toLowerCase() : ''
      console.error(`[administrator-backfill] resolving administrator ${String(administrator.id)}`)
      if (!email) {
        rows.push({
          administratorId: String(administrator.id),
          email: '',
          status: 'skipped_missing_email',
        })
        continue
      }
      if (!apply) {
        const resolution = await resolveAdministratorMemberIdentity(identityPayload, administrator)
        console.error(`[administrator-backfill] resolved administrator ${String(administrator.id)} (${resolution.source})`)
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
      const resolution = await resolveAdministratorMemberIdentity(identityPayload, administrator)
      console.error(`[administrator-backfill] resolved administrator ${String(administrator.id)} (${resolution.source})`)
      if (resolution.source === 'ambiguous' || resolution.source === 'invalid') {
        rows.push({
          administratorId: String(administrator.id),
          email,
          status: `skipped_${resolution.source}`,
        })
        continue
      }
      const identity = await ensureAdministratorMemberIdentity(identityPayload, administrator)
      rows.push({
        administratorId: String(administrator.id),
        email,
        status: identity ? 'linked' : 'skipped_missing_email',
        ...(identity ? { memberId: String(identity.member.id) } : {}),
      })
    }

    console.error(`[administrator-backfill] serializing result (${rows.length} rows)`)
    console.log(JSON.stringify({ apply, administrators: rows }, null, 2))
    console.error('[administrator-backfill] result serialized')
  } finally {
    // Payload's postgres adapter owns a node-postgres pool. Close it after the
    // one-shot reconciliation so CI can finish cleanly instead of waiting on
    // idle sockets indefinitely.
    console.error('[administrator-backfill] closing Payload pool')
    await payload.db.pool.end()
    console.error('[administrator-backfill] Payload pool closed')
    if (memberLookupConnected) {
      console.error('[administrator-backfill] closing lookup client')
      await memberLookupClient.end()
      console.error('[administrator-backfill] lookup client closed')
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'unknown_error')
  process.exitCode = 1
})
