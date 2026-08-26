export type WeekAccess = 'free' | 'pro' | 'free_and_pro'

export type WeekEntry = {
  id: string
  slug: string
  title: string
  summary: string
  access: WeekAccess
  hasMentorship: boolean
  status: 'placeholder' | 'draft' | 'ready'
}

export type ProgrammeSummary = {
  totalWeeks: number
  publicLabel: string
  isPlaceholder: boolean
  supportEmail: string
}

const WEEKS: WeekEntry[] = [
  {
    id: 'week-01',
    slug: 'strategy-selection',
    title: 'Strategy Selection',
    summary: 'Identify the right property strategy for your goals and market conditions.',
    access: 'free_and_pro',
    hasMentorship: false,
    status: 'placeholder',
  },
  {
    id: 'week-02',
    slug: 'market-analysis',
    title: 'Market Analysis',
    summary: 'Research and evaluate target areas using yield, growth, and demand indicators.',
    access: 'free_and_pro',
    hasMentorship: false,
    status: 'placeholder',
  },
  {
    id: 'week-03',
    slug: 'team-and-power-circle',
    title: 'Team & Power Circle',
    summary: 'Build the relationships and professional network needed to execute deals.',
    access: 'free_and_pro',
    hasMentorship: true,
    status: 'placeholder',
  },
  {
    id: 'week-04',
    slug: 'numbers-that-matter',
    title: 'Numbers That Matter',
    summary: 'Master yield, ROI, BRRR analysis, and risk assessment.',
    access: 'pro',
    hasMentorship: false,
    status: 'placeholder',
  },
  {
    id: 'week-05',
    slug: 'sourcing-and-negotiation',
    title: 'Sourcing & Negotiation',
    summary: 'Find off-market deals and negotiate terms that protect your upside.',
    access: 'pro',
    hasMentorship: true,
    status: 'placeholder',
  },
  {
    id: 'week-06',
    slug: 'funding-options',
    title: 'Funding Options',
    summary: 'Compare buy-to-let mortgages, bridging loans, private finance, and joint ventures.',
    access: 'pro',
    hasMentorship: false,
    status: 'placeholder',
  },
  {
    id: 'week-07',
    slug: 'refurbs-and-lettings',
    title: 'Refurbs & Lettings',
    summary: 'Plan refurb budgets, manage contractors, and prepare for tenancy.',
    access: 'pro',
    hasMentorship: true,
    status: 'placeholder',
  },
  {
    id: 'week-08',
    slug: 'first-deal-to-portfolio',
    title: 'First Deal to Portfolio',
    summary: 'Close your first deal and create a repeatable system for portfolio growth.',
    access: 'pro',
    hasMentorship: true,
    status: 'placeholder',
  },
]

export function getAllWeeks(): WeekEntry[] {
  return WEEKS
}

export function getWeekBySlug(slug: string): WeekEntry | null {
  return WEEKS.find((week) => week.slug === slug) ?? null
}

export function getProgrammeSummary(): ProgrammeSummary {
  return {
    totalWeeks: WEEKS.length,
    publicLabel: 'JPV Bootcamp programme',
    isPlaceholder: true,
    supportEmail: 'jpvbootcamp@gmail.com',
  }
}

export function getPublicSafeProgramme(): WeekEntry[] {
  return WEEKS
}