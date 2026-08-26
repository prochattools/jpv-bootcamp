import Link from 'next/link'

type AdminNavLink = {
  href: string
  label: string
}

type AdminNavGroup = {
  label: string
  links: AdminNavLink[]
}

const workspaceLinks: AdminNavLink[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/portal', label: 'Member portal' },
  { href: '/admin/collections/payload_members', label: 'People & access' },
  { href: '/admin/collections/payload_billing_accounts', label: 'Billing' },
  { href: '/admin/collections/payload_membership_support_records', label: 'Sponsored access' },
  { href: '/operations/support-requests', label: 'Support requests' },
]

const recordGroups: AdminNavGroup[] = [
  {
    label: 'Learning',
    links: [
      { href: '/admin/collections/payload_courses', label: 'Courses' },
      { href: '/admin/collections/payload_course_modules', label: 'Course modules' },
      { href: '/admin/collections/payload_lessons', label: 'Lessons' },
      { href: '/admin/collections/payload_lesson_comments', label: 'Lesson comments' },
      { href: '/admin/collections/payload_course_access_preview', label: 'Course access previews' },
      { href: '/admin/collections/payload_private_media', label: 'Private media' },
      { href: '/admin/collections/payload_lesson_resources', label: 'Lesson resources' },
      { href: '/admin/collections/payload_course_enrollments', label: 'Course enrollments' },
      { href: '/admin/collections/payload_lesson_progress', label: 'Lesson progress' },
      { href: '/admin/collections/live_sessions', label: 'Live sessions' },
      { href: '/admin/collections/payload_media', label: 'Media' },
      { href: '/admin/collections/payload_pages', label: 'Pages' },
      { href: '/admin/collections/payload_posts', label: 'Posts' },
      { href: '/admin/collections/payload_categories', label: 'Categories' },
      { href: '/admin/collections/bunny_videos', label: 'Bunny videos' },
    ],
  },
  {
    label: 'Community',
    links: [
      { href: '/admin/collections/payload_member_groups', label: 'Member groups' },
      { href: '/admin/collections/payload_spaces', label: 'Community spaces' },
      { href: '/admin/collections/payload_space_memberships', label: 'Space memberships' },
      { href: '/admin/collections/payload_space_posts', label: 'Community posts' },
      { href: '/admin/collections/payload_space_comments', label: 'Community comments' },
      { href: '/admin/collections/payload_space_reactions', label: 'Community reactions' },
      { href: '/admin/collections/payload_space_files', label: 'Community files' },
      { href: '/admin/collections/payload_chat_threads', label: 'Chat threads' },
      { href: '/admin/collections/payload_chat_messages', label: 'Chat messages' },
      { href: '/admin/collections/payload_member_notifications', label: 'Member notifications' },
      { href: '/admin/collections/payload_engagement_reactions', label: 'Engagement reactions' },
    ],
  },
  {
    label: 'Members & access',
    links: [
      { href: '/admin/collections/payload_members', label: 'Members' },
      { href: '/admin/collections/payload_member_profiles', label: 'Member profiles' },
      { href: '/admin/collections/payload_access_groups', label: 'Access groups' },
      { href: '/admin/collections/payload_access_policies', label: 'Access policies' },
      { href: '/admin/collections/payload_access_grants', label: 'Access grants' },
      { href: '/admin/collections/payload_entitlement_events', label: 'Entitlement events' },
      { href: '/admin/collections/payload_member_verification_tokens', label: 'Verification records' },
      { href: '/admin/collections/payload_member_security_events', label: 'Security events' },
    ],
  },
  {
    label: 'Billing & payments',
    links: [
      { href: '/admin/collections/payload_billing_accounts', label: 'Billing accounts' },
      { href: '/admin/collections/payload_subscriptions', label: 'Subscriptions' },
      { href: '/admin/collections/payload_payments', label: 'Payments' },
      { href: '/admin/collections/payload_billing_actions', label: 'Billing actions' },
      { href: '/admin/collections/payload_stripe_events', label: 'Stripe events' },
    ],
  },
  {
    label: 'Sponsored access',
    links: [
      { href: '/admin/collections/payload_membership_support_records', label: 'Applications' },
      { href: '/admin/collections/payload_pay_it_forward_funding', label: 'Pay-it-forward funding' },
      { href: '/admin/collections/payload_membership_funding_sources', label: 'Funding sources' },
      { href: '/admin/collections/payload_membership_review_queue_items', label: 'Review queue' },
      { href: '/admin/collections/payload_membership_vouchers', label: 'Vouchers' },
      { href: '/admin/collections/payload_membership_reconciliations', label: 'Reconciliations' },
      { href: '/admin/collections/payload_membership_audit_history', label: 'Audit history' },
      { href: '/admin/collections/payload_membership_administration_actions', label: 'Administration actions' },
      { href: '/admin/collections/payload_operator_notes', label: 'Operator notes' },
      { href: '/admin/collections/payload_stripe_shadow_projections', label: 'Stripe projections' },
    ],
  },
  {
    label: 'Partners & referrals',
    links: [
      { href: '/admin/collections/payload_partner_affiliates', label: 'Partners' },
      { href: '/admin/collections/payload_partner_applications', label: 'Partner applications' },
      { href: '/admin/collections/payload_partner_events', label: 'Partner events' },
      { href: '/admin/collections/payload_affiliates', label: 'Affiliates' },
      { href: '/admin/collections/payload_affiliate_referrals', label: 'Affiliate referrals' },
      { href: '/admin/collections/payload_affiliate_commissions', label: 'Affiliate commissions' },
    ],
  },
  {
    label: 'Communications & operations',
    links: [
      { href: '/admin/collections/payload_contacts', label: 'Contacts' },
      { href: '/admin/collections/payload_crm_tags', label: 'CRM tags' },
      { href: '/admin/collections/payload_contact_tags', label: 'Contact tags' },
      { href: '/admin/collections/payload_contact_notes', label: 'Contact notes' },
      { href: '/admin/collections/payload_email_templates', label: 'Email templates' },
      { href: '/admin/collections/payload_email_events', label: 'Email events' },
      { href: '/admin/collections/payload_email_actions', label: 'Email actions' },
      { href: '/admin/collections/payload_admin_notifications', label: 'Admin notifications' },
    ],
  },
  {
    label: 'Settings & system',
    links: [
      { href: '/admin/globals/portalSettings', label: 'Portal settings' },
      { href: '/admin/globals/payItForwardSettings', label: 'Pay-it-forward settings' },
      { href: '/admin/collections/payload_portal_nav_items', label: 'Portal navigation' },
      { href: '/admin/collections/payload_users', label: 'Administrators' },
      { href: '/admin/collections/payload_audit_events', label: 'Audit events' },
    ],
  },
]

export function JPVAdminDashboardNav() {
  return (
    <div className='jpv-admin-nav' data-jpv-admin-shortcuts>
      <p className='jpv-admin-nav__eyebrow'>JPV workspace</p>
      <div className='jpv-admin-nav__primary'>
        {workspaceLinks.map((link) => (
          <Link className='jpv-admin-nav__link' href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </div>

      <details className='jpv-admin-nav__records'>
        <summary>All CMS records</summary>
        <div className='jpv-admin-nav__record-groups'>
          {recordGroups.map((group) => (
            <section key={group.label}>
              <h2>{group.label}</h2>
              <div>
                {group.links.map((link) => (
                  <Link href={link.href} key={`${group.label}-${link.href}`}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </details>
    </div>
  )
}
