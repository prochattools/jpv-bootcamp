import type { Payload } from 'payload'

const STAGING_ENVS = ['preview', 'staging'] as const

function isStagingEnv(): boolean {
  const env = (process.env.DEPLOYMENT_ENV ?? '').trim().toLowerCase()
  return (STAGING_ENVS as readonly string[]).includes(env)
}

export async function stagingAutoProvision(payload: Payload): Promise<void> {
  if (!isStagingEnv()) return

  await provisionAdmin(payload)
  await provisionMember(payload)
}

async function provisionAdmin(payload: Payload): Promise<void> {
  const email = process.env.STAGING_ADMIN_EMAIL?.trim()
  const password = process.env.STAGING_ADMIN_PASSWORD?.trim()
  if (!email || !password) return

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
  if (!email || !password) return

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
        account_status: 'active',
        emailVerified: true,
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
      account_status: 'active',
      emailVerified: true,
      source: 'staging_provision',
      name: 'Staging QA',
    } as never,
    overrideAccess: true,
  })
  console.info('staging-auto-provision: member created')
}
