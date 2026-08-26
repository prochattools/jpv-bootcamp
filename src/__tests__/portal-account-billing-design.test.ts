import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const source = readFileSync(resolve(root, 'src/app/(frontend)/portal/[section]/page.tsx'), 'utf8')
const accountStart = source.indexOf("if (section === 'account')")
const groupsStart = source.indexOf("if (section === 'groups')")
const billingStart = source.indexOf("if (section === 'billing')")
const fallbackStart = source.indexOf('const content = sectionContent[section]')
const accountSection = source.slice(accountStart, groupsStart)
const billingSection = source.slice(billingStart, fallbackStart)

describe('portal account and billing design coherence', () => {
  it('keeps account and billing presentation separated', () => {
    expect(accountSection).toContain('Manage your profile, sign-in email, password, and account security.')
    expect(accountSection).not.toContain('Billing projection summary')
    expect(accountSection).not.toContain('BillingPortalButton')
    expect(billingSection).toContain('Review your membership, renewal status, invoices, and secure payment settings.')
  })

  it('uses compact responsive section navigation', () => {
    expect(source).toContain('function PortalSectionNavigation')
    expect(source).toContain("className='flex gap-2 overflow-x-auto border-b border-jpv-border pb-3'")
    expect(accountSection).toContain("href: '#profile'")
    expect(accountSection).toContain("href: '#password'")
    expect(accountSection).toContain("href: '#email'")
    expect(billingSection).toContain("href: '#status'")
    expect(billingSection).toContain("href: '#manage'")
    expect(billingSection).toContain("href: '#projection'")
  })

  it('humanizes membership naming', () => {
    expect(source).toContain("return 'JPV Bootcamp Membership'")
    expect(source).toContain('Your JPV Bootcamp Membership is within its initial 12-month commitment.')
    expect(billingSection).not.toContain('Your Pro Monthly membership')
  })

  it('preserves existing account and billing actions', () => {
    expect(source).toContain('updateMemberProfile')
    expect(accountSection).toContain('<PasswordChangeForm />')
    expect(accountSection).toContain('<EmailChangeForm />')
    expect(billingSection).toContain('<BillingPortalButton />')
    expect(billingSection).toContain('<MemberCheckoutButtons />')
    expect(billingSection).toContain('action={requestMembershipCancellation}')
  })

  it('uses JPV form, card, button, and notice utilities', () => {
    expect(source).toContain('portalFieldClass')
    expect(source).toContain('portalCardClass')
    expect(accountSection).toContain("className='jpv-button-primary min-h-11'")
    expect(billingSection).toContain('jpv-notice')
    expect(source).not.toMatch(/(?:bg|text|border)-(?:amber|blue|sky|orange|gray|slate)-/)
    expect(source).not.toContain('bg-neutral-950')
  })
})
