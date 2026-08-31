import { randomBytes } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizeEmail } from '@/lib/normalize-email'
import { redactEmail } from '@/lib/log-redact'

export type CheckoutMemberProvisionResult = {
  memberId: string
  created: boolean
  password: string | null
}

function generateReadablePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(12)
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length]
  }
  return password
}

export async function provisionMemberFromCheckout(params: {
  email: string
  displayName?: string | null
  stripeCustomerId?: string | null
  /**
   * The canonical checkout webhook may run after the billing shadow sync.
   * In that case the shadow sync has created an active checkout member, but
   * the member has not received onboarding credentials yet.
   */
  issueCredentials?: boolean
  source?: 'stripe_checkout' | 'admin_created' | 'migration'
}): Promise<CheckoutMemberProvisionResult> {
  const email = normalizeEmail(params.email)
  if (!email) {
    console.warn('provisionMemberFromCheckout: invalid email', { email: redactEmail(params.email) })
    return { memberId: '', created: false, password: null }
  }

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    const existingMember = existing.docs[0] as {
      id: string | number
      accountStatus?: string
      emailVerifiedAt?: string | Date | null
      source?: string
      lastLoginAt?: string | Date | null
    }

    const isUnclaimedCheckoutMember =
      params.issueCredentials === true &&
      existingMember.source === 'stripe_checkout' &&
      existingMember.accountStatus === 'active' &&
      !existingMember.lastLoginAt

    // The billing shadow sync can create this row before the canonical
    // checkout webhook runs. Rotate its one-time password so the canonical
    // activation email can contain credentials. This is safe for an
    // unclaimed checkout account because it has never recorded a login.
    if (isUnclaimedCheckoutMember) {
      const password = generateReadablePassword()
      await payload.update({
        collection: 'payload_members',
        id: existingMember.id,
        data: {
          password,
          emailVerifiedAt:
            existingMember.emailVerifiedAt instanceof Date
              ? existingMember.emailVerifiedAt.toISOString()
              : existingMember.emailVerifiedAt ?? new Date().toISOString(),
        },
        overrideAccess: true,
      })

      console.info('provisionMemberFromCheckout: checkout credentials prepared', {
        email: redactEmail(email),
        memberId: existingMember.id,
      })
      return { memberId: String(existingMember.id), created: false, password }
    }

    // Older checkout-created rows were stored as active without this marker
    // and consequently failed the member sign-in eligibility check.
    if (
      existingMember.source === 'stripe_checkout' &&
      existingMember.accountStatus === 'active' &&
      !existingMember.emailVerifiedAt
    ) {
      await payload.update({
        collection: 'payload_members',
        id: existingMember.id,
        data: { emailVerifiedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }

    console.info('provisionMemberFromCheckout: member already exists', {
      email: redactEmail(email),
      memberId: existingMember.id,
    })
    return { memberId: String(existingMember.id), created: false, password: null }
  }

  const password = generateReadablePassword()

  const member = await payload.create({
    collection: 'payload_members',
    data: {
      email,
      password,
      accountStatus: 'active',
      emailVerifiedAt: new Date().toISOString(),
      source: params.source ?? 'stripe_checkout',
    },
    overrideAccess: true,
  })

  const displayName = params.displayName || email.split('@')[0]
  try {
    await payload.create({
      collection: 'payload_member_profiles',
      data: {
        member: member.id,
        displayName,
        marketingConsent: false,
        transactionalEmailConsent: true,
      },
      overrideAccess: true,
    })
  } catch {
    // profile creation is non-critical
  }

  console.info('provisionMemberFromCheckout: member created', {
    email: redactEmail(email),
    memberId: member.id,
    hasDisplayName: Boolean(params.displayName),
  })

  return { memberId: String(member.id), created: true, password }
}
