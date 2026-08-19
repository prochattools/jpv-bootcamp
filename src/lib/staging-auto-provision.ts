import type { Payload } from 'payload'
import { createLocalReq } from 'payload'

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
  const memberId = await provisionMember(payload)
  if (memberId) {
    await provisionMemberSubscription(payload, memberId)
  }
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
    const doc = existing.docs[0] as { id: string | number; loginAttempts?: number; lockUntil?: string | null }
    // Only unlock if locked — never reset password on startup (create-if-missing only)
    if (doc.loginAttempts || doc.lockUntil) {
      await payload.update({
        collection: 'payload_users',
        id: doc.id,
        data: { loginAttempts: 0, lockUntil: null } as never,
        overrideAccess: true,
      })
      console.info('staging-auto-provision: admin account unlocked (was locked)')
    } else {
      console.info('staging-auto-provision: admin already exists, no changes (create-if-missing only)')
    }
    return
  }

  await payload.create({
    collection: 'payload_users',
    data: { email, password, role: 'admin' } as never,
    overrideAccess: true,
  })
  console.info('staging-auto-provision: admin user created')
}

async function provisionMember(payload: Payload): Promise<string | null> {
  const email = process.env.STAGING_MEMBER_EMAIL?.trim()
  const password = process.env.STAGING_MEMBER_PASSWORD?.trim()
  if (!email || !password) {
    console.info('staging-auto-provision: member skipped (STAGING_MEMBER_EMAIL=%s, password=%s)', email ? 'set' : 'unset', password ? 'set' : 'unset')
    return null
  }

  const existing = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const doc = existing.docs[0] as { id: string | number; loginAttempts?: number; lockUntil?: string | null }
    // Only unlock if locked — never reset password on startup (create-if-missing only)
    if (doc.loginAttempts || doc.lockUntil) {
      await payload.update({
        collection: 'payload_members',
        id: doc.id,
        data: { loginAttempts: 0, lockUntil: null } as never,
        overrideAccess: true,
      })
      console.info('staging-auto-provision: member account unlocked (was locked)')
    } else {
      console.info('staging-auto-provision: member already exists, no changes (create-if-missing only)')
    }
    return String(doc.id)
  }

  const created = await payload.create({
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
  return String((created as { id: string | number }).id)
}

async function provisionMemberSubscription(payload: Payload, memberId: string): Promise<void> {
  // The Payload Local API creates a req with req.user=null in onInit context.
  // Field validators call req.payloadDataLoader.find() to verify relationship targets —
  // that find is called WITHOUT overrideAccess, so payload_members.read returns false
  // for a null user and the member is not found, causing ValidationError "field is invalid: Member".
  // Fix: create a system req with a synthetic admin user so the internal validator find
  // sees an authenticated user and can read the member.
  const systemReq = await createLocalReq(
    { user: { id: 0, email: 'system@internal.invalid', collection: 'payload_users' } as never },
    payload,
  )

  const existing = await payload.find({
    collection: 'payload_subscriptions',
    where: {
      and: [
        { member: { equals: memberId } },
        { plan: { equals: 'jpv_bootcamp_membership' } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
    depth: 0,
    req: systemReq,
  })

  if (existing.docs.length > 0) {
    console.info('staging-auto-provision: member subscription already exists, skipping')
    return
  }

  // Resolve or create billing account (required by payload_subscriptions)
  const existingBilling = await payload.find({
    collection: 'payload_billing_accounts',
    where: { member: { equals: memberId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
    req: systemReq,
  })

  let billingAccountId: string
  if (existingBilling.docs.length > 0) {
    billingAccountId = String((existingBilling.docs[0] as { id: string | number }).id)
    console.info('staging-auto-provision: using existing billing account %s', billingAccountId)
  } else {
    const memberEmail = process.env.STAGING_MEMBER_EMAIL?.trim() ?? 'staging@example.com'
    const newBilling = await payload.create({
      collection: 'payload_billing_accounts',
      data: {
        displayName: 'Staging Member Billing',
        member: memberId,
        stripeCustomerId: 'cus_staging_test_member',
        stripeMode: 'test',
        billingStatus: 'active',
        billingEmail: memberEmail,
      } as never,
      overrideAccess: true,
      req: systemReq,
    })
    billingAccountId = String((newBilling as { id: string | number }).id)
    console.info('staging-auto-provision: billing account created %s', billingAccountId)
  }

  // Provision a mock active subscription so entitlements resolve without any staging DB mutation
  const periodStart = new Date()
  const periodEnd = new Date(periodStart.getTime() + 365 * 24 * 60 * 60 * 1000)
  await payload.create({
    collection: 'payload_subscriptions',
    data: {
      displayName: 'Staging Test Membership',
      member: memberId,
      billingAccount: billingAccountId,
      stripeSubscriptionId: 'sub_staging_test_member',
      plan: 'jpv_bootcamp_membership',
      status: 'active',
      billingCadence: 'annual',
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    } as never,
    overrideAccess: true,
    req: systemReq,
  })
  console.info('staging-auto-provision: member subscription provisioned (plan=jpv_bootcamp_membership, status=active)')
}
