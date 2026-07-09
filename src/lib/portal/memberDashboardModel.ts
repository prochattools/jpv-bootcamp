export type DashboardCard = {
  id: string
  title: string
  summary: string
  href: string
  ctaLabel: string
  badge?: 'pro' | 'free' | 'support' | 'info'
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
    id: 'pro-membership',
    title: 'Pro Membership',
    summary: 'Full course access, mentorship sessions, protected resources, and community. £80/month or £880/year.',
    href: '/upgrade',
    ctaLabel: 'View Pro',
    badge: 'pro',
  },
  {
    id: 'programme',
    title: '8-Week Programme',
    summary: 'Weekly modules covering strategy, analysis, funding, deals, and portfolio growth.',
    href: '/programme',
    ctaLabel: 'View programme',
    badge: 'info',
  },
  {
    id: 'support',
    title: 'Support & Pay It Forward',
    summary: 'Sponsor a Free access seat or apply for controlled Free access after review.',
    href: '/support',
    ctaLabel: 'Learn more',
    badge: 'support',
  },
  {
    id: 'partner-referral',
    title: 'Partner Referral',
    summary: 'Apply through a partner referral to join the JPV Bootcamp community.',
    href: '/partner-referral',
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
      proDescription: 'Pro is the single paid JPV Bootcamp membership with full course access, mentorship, community, and billing self-service.',
      freeDescription: 'Free is controlled non-paid access only. Approved applicants receive Free access after manual review through support, pay-it-forward, or administrator action.',
      isPlaceholder: true,
    },
  }
}