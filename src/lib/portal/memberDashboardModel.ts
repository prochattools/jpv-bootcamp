export type DashboardCard = {
  id: string
  title: string
  summary: string
  href: string
  ctaLabel: string
  badge?: 'membership' | 'support' | 'info'
}

export type DashboardAccessSummary = {
  proDescription: string
  freeDescription: string
  isPlaceholder: boolean
}

export type DashboardModel = {
  cards: DashboardCard[]
  accessSummary: DashboardAccessSummary
}

const CARDS: DashboardCard[] = [
  {
    id: 'jpv-membership',
    title: 'JPV Bootcamp Membership',
    summary: 'Full course access, mentorship sessions, protected resources, and community. £80/month or £800/year.',
    href: '/portal/billing',
    ctaLabel: 'View membership',
    badge: 'membership',
  },
  {
    id: 'programme',
    title: '8-Week Programme',
    summary: 'Weekly modules covering strategy, analysis, funding, deals, and portfolio growth.',
    href: '/portal/programme',
    ctaLabel: 'View programme',
    badge: 'info',
  },
  {
    id: 'community',
    title: 'Community',
    summary: 'Preview of community spaces, forums, and private rooms. Full access requires active JPV Bootcamp Membership.',
    href: '/portal/community',
    ctaLabel: 'View community preview',
    badge: 'info',
  },
  {
    id: 'support',
    title: 'Support & Pay It Forward',
    summary: 'Sponsor a voucher-funded membership seat or request pay-it-forward support after review.',
    href: '/portal/support',
    ctaLabel: 'Learn more',
    badge: 'support',
  },
  {
    id: 'partner-referral',
    title: 'Partner Referral',
    summary: 'Apply through a partner referral to join the JPV Bootcamp community.',
    href: '/portal/partner-referral',
    ctaLabel: 'View partner referral',
    badge: 'info',
  },
]

export function getDashboardCards(): DashboardCard[] {
  return CARDS
}

export function getDashboardModel(): DashboardModel {
  return {
    cards: CARDS,
    accessSummary: {
      proDescription: 'JPV Bootcamp Membership is the single access model with full course access, mentorship, community, and billing self-service.',
      freeDescription: 'Voucher and pay-it-forward seats use the same membership access model after approval and webhook reconciliation.',
      isPlaceholder: true,
    },
  }
}
