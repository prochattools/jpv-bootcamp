import type { Payload } from 'payload'

const STAGING_ENVS = ['preview', 'staging'] as const

function isStagingEnv(): boolean {
  const env = (process.env.DEPLOYMENT_ENV ?? '').trim().toLowerCase()
  if ((STAGING_ENVS as readonly string[]).includes(env)) return true
  // Fallback: treat as staging if staging credentials are provided but DEPLOYMENT_ENV is unset
  // Covers misconfigured Dokploy apps where DEPLOYMENT_ENV was not set
  const hasCredentials =
    !!(process.env.STAGING_MEMBER_EMAIL && process.env.STAGING_MEMBER_PASSWORD) ||
    !!(process.env.STAGING_ADMIN_EMAIL && process.env.STAGING_ADMIN_PASSWORD)
  if (hasCredentials) {
    console.warn('staging-auto-provision: DEPLOYMENT_ENV not set to preview/staging but staging credentials are present — treating as staging')
    return true
  }
  return false
}

export async function stagingAutoProvision(payload: Payload): Promise<void> {
  if (!isStagingEnv()) {
    console.info('staging-auto-provision: skipped (DEPLOYMENT_ENV=%s)', process.env.DEPLOYMENT_ENV ?? 'unset')
    return
  }
  console.info('staging-auto-provision: running for DEPLOYMENT_ENV=%s', process.env.DEPLOYMENT_ENV)
  await provisionAdmin(payload)
  await provisionMember(payload)
}

async function provisionAdmin(payload: Payload): Promise<void> {
  const email = process.env.STAGING_ADMIN_EMAIL?.trim()
  const password = process.env.STAGING_ADMIN_PASSWORD?.trim()
  if (!email || !password) {
    console.info('staging-auto-provision: admin skipped (STAGING_ADMIN_EMAIL=%s, password=%s)', email ? 'set' : 'unset', password ? 'set' : 'unset')
    return
  }

  const existing = await payload.find({
    collection: 'payload_users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'payload_users',
      id: existing.docs[0].id,
      data: { password, loginAttempts: 0, lockUntil: null } as never,
      overrideAccess: true,
    })
    console.info('staging-auto-provision: admin password updated and lock cleared')
    return
  }

  await payload.create({
    collection: 'payload_users',
    data: { email, password, role: 'admin' } as never,
    overrideAccess: true,
  })
  console.info('staging-auto-provision: admin user created')
}

async function provisionMember(payload: Payload): Promise<void> {
  const email = process.env.STAGING_MEMBER_EMAIL?.trim()
  const password = process.env.STAGING_MEMBER_PASSWORD?.trim()
  if (!email || !password) {
    console.info('staging-auto-provision: member skipped (STAGING_MEMBER_EMAIL=%s, password=%s)', email ? 'set' : 'unset', password ? 'set' : 'unset')
    return
  }

  const existing = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'payload_members',
      id: existing.docs[0].id,
      data: {
        password,
        accountStatus: 'active',
        emailVerifiedAt: new Date().toISOString(),
        loginAttempts: 0,
        lockUntil: null,
      } as never,
      overrideAccess: true,
    })
    console.info('staging-auto-provision: member password updated and lock cleared')
    return
  }

  await payload.create({
    collection: 'payload_members',
    data: {
      email,
      password,
      accountStatus: 'active',
      emailVerifiedAt: new Date().toISOString(),
      source: 'admin_created',
    } as never,
    overrideAccess: true,
  })
  console.info('staging-auto-provision: member created')
}
