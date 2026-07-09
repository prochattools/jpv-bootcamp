export type ReviewSectionStatus = 'preview' | 'manual_review' | 'blocked' | 'ready_for_testing'

export type AdminReviewSection = {
  slug: string
  title: string
  summary: string
  description: string
  status: ReviewSectionStatus
  ownerLabel: string
  href: string
  blockerCount: number
  actionCount: number
  notes: string
}

export type AdminReviewExportRow = {
  section: string
  status: string
  owner: string
  blockers: number
  actions: number
  notes: string
}

export type AdminReviewSummary = {
  totalSections: number
  blockedCount: number
  manualReviewCount: number
  readyForTestingCount: number
  previewCount: number
  totalBlockers: number
  isPreview: boolean
}

const SECTIONS: AdminReviewSection[] = [
  {
    slug: 'partner-referrals',
    title: 'Partner Referrals',
    summary: 'Partner referral application form and validation service. MVP complete; review queue is manual.',
    description: 'The partner referral form collects name, email, optional phone/message, and consent. Applications return a pending-review reference. No DB-backed queue exists — all review is manual via form submission output.',
    status: 'ready_for_testing',
    ownerLabel: 'MVP owner',
    href: '/portal/partner-referral',
    blockerCount: 0,
    actionCount: 1,
    notes: 'Form works end-to-end. Live queue and notification pending migration.',
  },
  {
    slug: 'support-pay-it-forward',
    title: 'Support & Pay It Forward',
    summary: 'Sponsor intent and recipient application forms with validation. MVP complete; all follow-up is manual.',
    description: 'Sponsors submit intent (manual follow-up reference returned). Recipients submit application (pending-review reference returned). No DB-backed queue — all review is manual.',
    status: 'ready_for_testing',
    ownerLabel: 'MVP owner',
    href: '/portal/support',
    blockerCount: 0,
    actionCount: 2,
    notes: 'Both sponsor and recipient flows work. Live queue, email, and seat grants pending migration.',
  },
  {
    slug: 'programme',
    title: '8-Week Programme',
    summary: 'Programme catalog MVP shell with typed weekly modules and public overview route.',
    description: 'Eight-week programme catalog with module titles, descriptions, and session counts rendered on a public overview page. Content is representative preview copy, not final.',
    status: 'preview',
    ownerLabel: 'MVP owner',
    href: '/portal/programme',
    blockerCount: 0,
    actionCount: 0,
    notes: 'Content is preview/placeholder only. Client input due 15 July.',
  },
  {
    slug: 'community',
    title: 'Community Preview',
    summary: 'Community spaces preview with 5 rooms, access labels, and preview threads.',
    description: 'Five community spaces (announcements, pro-community, qa-forum, private-mastermind, resource-library) rendered from a pure local model. Access labels and preview-only disclaimer shown.',
    status: 'preview',
    ownerLabel: 'MVP owner',
    href: '/portal/community',
    blockerCount: 0,
    actionCount: 0,
    notes: 'No live posting, messaging, or notifications. Full community pending migration.',
  },
  {
    slug: 'membership-billing',
    title: 'Membership & Billing',
    summary: 'Pro membership page, preview dashboard, and billing readiness links configured.',
    description: 'Pro membership upgrade page at /upgrade, public preview dashboard at /dashboard, and billing readiness report present. No live subscription or payment processing is active in preview.',
    status: 'preview',
    ownerLabel: 'MVP owner',
    href: '/dashboard',
    blockerCount: 1,
    actionCount: 0,
    notes: 'Live billing requires migration, Stripe webhook verification, and provider email live check.',
  },
  {
    slug: 'member-portal',
    title: 'Member Portal',
    summary: 'Authenticated portal route at /portal (requires Payload DB + auth). Preview dashboard at /dashboard.',
    description: 'The existing /portal route requires real Payload authentication and DB access. The public preview dashboard at /dashboard renders the same cards from a pure local model for testing.',
    status: 'blocked',
    ownerLabel: 'MVP owner',
    href: '/portal',
    blockerCount: 1,
    actionCount: 0,
    notes: 'Blocked on migration approval: /portal requires live Payload session and DB.',
  },
]

export function getAdminReviewSections(): AdminReviewSection[] {
  return SECTIONS
}

export function getReviewSectionBySlug(slug: string): AdminReviewSection | undefined {
  return SECTIONS.find((section) => section.slug === slug)
}

export function getAdminReviewSummary(): AdminReviewSummary {
  return {
    totalSections: SECTIONS.length,
    blockedCount: SECTIONS.filter((s) => s.status === 'blocked').length,
    manualReviewCount: SECTIONS.filter((s) => s.status === 'manual_review').length,
    readyForTestingCount: SECTIONS.filter((s) => s.status === 'ready_for_testing').length,
    previewCount: SECTIONS.filter((s) => s.status === 'preview').length,
    totalBlockers: SECTIONS.reduce((sum, s) => sum + s.blockerCount, 0),
    isPreview: true,
  }
}

export function getAdminReviewExportRows(): AdminReviewExportRow[] {
  return SECTIONS.map((section) => ({
    section: section.title,
    status: section.status.replace(/_/g, ' '),
    owner: section.ownerLabel,
    blockers: section.blockerCount,
    actions: section.actionCount,
    notes: section.notes,
  }))
}
