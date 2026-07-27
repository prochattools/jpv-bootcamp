import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..')

// Verify collection slugs match what the dashboard links point to.
// Payload admin collection routes follow: /admin/collections/<slug>
function collectionExists(slug: string): boolean {
  const collections = readFileSync(resolve(root, 'src/payload.config.ts'), 'utf8')
  // The slug must appear as a string literal in at least one collection file
  const files = [
    'src/collections/members/Members.ts',
    'src/collections/billing/Billing.ts',
    'src/collections/membership-support/MembershipSupport.ts',
    'src/collections/membership-support/Voucher.ts',
    'src/collections/membership-support/PayItForward.ts',
    'src/collections/partners/Partners.ts',
    'src/collections/affiliates/Affiliates.ts',
    'src/collections/community/Community.ts',
    'src/collections/PayloadCoursePrototype.ts',
  ]
  return files.some((f) => {
    try {
      const content = readFileSync(resolve(root, f), 'utf8')
      return content.includes(`'${slug}'`) || content.includes(`"${slug}"`)
    } catch {
      return false
    }
  })
}

// All Payload admin collection hrefs used in the dashboard
const dashboardCollectionLinks = [
  'payload_members',
  'payload_billing_accounts',
  'payload_membership_support_records',
  'payload_membership_vouchers',
  'payload_pay_it_forward_funding',
  'payload_partner_applications',
  'payload_affiliate_commissions',
  'payload_space_posts',
  'payload_courses',
  'payload_payments',
]

for (const slug of dashboardCollectionLinks) {
  assert.ok(
    collectionExists(slug),
    `Dashboard links to /admin/collections/${slug} but no collection file declares this slug`,
  )
}

// Dashboard component must contain each expected link
const dashboard = readFileSync(resolve(root, 'src/components/payload/JPVAdminDashboard.tsx'), 'utf8')

const expectedHrefs = [
  '/admin/collections/payload_members',
  '/admin/collections/payload_billing_accounts',
  '/admin/collections/payload_membership_support_records',
  '/admin/collections/payload_partner_applications',
  '/admin/collections/payload_courses',
]

for (const href of expectedHrefs) {
  assert.ok(dashboard.includes(href), `Dashboard must include Quick action link: ${href}`)
}

// Needs-attention section must have filtered member link
assert.ok(
  dashboard.includes('payload_members?where[accountStatus][equals]=pending'),
  'Dashboard must link directly to pending members filter',
)

// Verify no dead legacy links remain in dashboard
const forbiddenHrefs = [
  '/api/health/deployment',
  '/admin/collections/payload_member_security_events',
  '/admin/collections/payload_membership_reconciliations',
  '/admin/collections/payload_stripe_shadow_projections',
]

for (const href of forbiddenHrefs) {
  assert.ok(
    !dashboard.includes(href),
    `Dashboard must not expose developer/internal link: ${href}`,
  )
}

// Sidebar groups — verify renamed groups exist in collection files
const crmFile = readFileSync(resolve(root, 'src/collections/crm/CRM.ts'), 'utf8')
assert.ok(crmFile.includes("'Emails'"), "CRM group must be 'Emails' for operator clarity")
assert.ok(!crmFile.includes("'Administration'"), "CRM group 'Administration' was renamed to 'Emails'")

const membersFile = readFileSync(resolve(root, 'src/collections/members/Members.ts'), 'utf8')
assert.ok(membersFile.includes("group: 'Members'"), "Members group must be 'Members' not 'Members & Access'")
assert.ok(!membersFile.includes("'Members & Access'"), "Members group 'Members & Access' was renamed to 'Members'")

// Member security events must be hidden (audit trail, not operator action)
assert.ok(
  membersFile.includes("group: 'Members',\n    hidden: true,"),
  'PayloadMemberSecurityEvents must be hidden from operator sidebar',
)

// Verification records must be hidden
const verificationFile = readFileSync(resolve(root, 'src/collections/members/MemberEmailVerificationRecords.ts'), 'utf8')
assert.ok(!verificationFile.includes("'Members & Access'"), "Verification records must use 'Members' group")

// Community member groups belong in Community sidebar group
const communityFile = readFileSync(resolve(root, 'src/collections/community/Community.ts'), 'utf8')
assert.ok(!communityFile.includes("group: 'Members & Access'"), "Member Groups must not appear in 'Members & Access' group")

// Access control uses Members group
const accessFile = readFileSync(resolve(root, 'src/collections/access/AccessControl.ts'), 'utf8')
assert.ok(!accessFile.includes("'Members & Access'"), "Access control group 'Members & Access' was renamed to 'Members'")

// Audit/Users use System group (set in prior phase)
const auditFile = readFileSync(resolve(root, 'src/collections/audit/AuditEvents.ts'), 'utf8')
assert.ok(auditFile.includes("'System'"), "Audit events must be in 'System' group")

const usersFile = readFileSync(resolve(root, 'src/collections/PayloadUsers.ts'), 'utf8')
assert.ok(usersFile.includes("'System'"), "Payload users must be in 'System' group")

console.log('payload_admin_dashboard_links.test.ts passed')
