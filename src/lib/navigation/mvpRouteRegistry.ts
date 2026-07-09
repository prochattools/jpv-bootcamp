export type MvpRouteGroup = 'public' | 'member_preview' | 'operator' | 'billing_membership'

export type MvpRouteStatus = 'ready_for_testing' | 'preview' | 'auth_required' | 'manual_review'

export type MvpRouteAccess = 'public' | 'controlled_free' | 'pro' | 'operator' | 'auth_required'

export type MvpRoute = {
  id: string
  label: string
  href: string
  summary: string
  group: MvpRouteGroup
  status: MvpRouteStatus
  access: MvpRouteAccess
}

const ROUTES: MvpRoute[] = [
  {
    id: 'dashboard',
    label: 'Preview dashboard',
    href: '/dashboard',
    summary: 'Public preview dashboard for testing all MVP feature slices. No auth or DB required.',
    group: 'member_preview',
    status: 'ready_for_testing',
    access: 'public',
  },
  {
    id: 'portal',
    label: 'Member portal',
    href: '/portal',
    summary: 'Real authenticated member portal. Requires Payload DB-backed session. Not usable in preview mode.',
    group: 'member_preview',
    status: 'auth_required',
    access: 'auth_required',
  },
  {
    id: 'programme',
    label: '8-Week Programme',
    href: '/programme',
    summary: 'Course programme catalog with eight weekly modules, descriptions, and session counts.',
    group: 'public',
    status: 'preview',
    access: 'public',
  },
  {
    id: 'community',
    label: 'Community preview',
    href: '/community',
    summary: 'Community spaces, forums, and room previews. Full access requires Pro membership.',
    group: 'public',
    status: 'preview',
    access: 'public',
  },
  {
    id: 'support',
    label: 'Support & Pay It Forward',
    href: '/support',
    summary: 'Sponsor a Free access seat or apply for controlled Free access after manual review.',
    group: 'public',
    status: 'ready_for_testing',
    access: 'public',
  },
  {
    id: 'partner-referral',
    label: 'Partner Referral',
    href: '/partner-referral',
    summary: 'Apply through a partner referral to join the JPV Bootcamp community.',
    group: 'public',
    status: 'ready_for_testing',
    access: 'public',
  },
  {
    id: 'upgrade',
    label: 'Pro Membership',
    href: '/upgrade',
    summary: 'Pro membership pricing: £80/month or £880/year. Full course access, mentorship, and community.',
    group: 'billing_membership',
    status: 'preview',
    access: 'public',
  },
  {
    id: 'admin-review',
    label: 'Admin review dashboard',
    href: '/admin/review',
    summary: 'Operator review dashboard with section status, blockers, actions, and export preview.',
    group: 'operator',
    status: 'preview',
    access: 'operator',
  },
]

export function getMvpRoutes(): MvpRoute[] {
  return ROUTES
}

export function getRoutesByGroup(group: MvpRouteGroup): MvpRoute[] {
  return ROUTES.filter((route) => route.group === group)
}

export function getRouteById(id: string): MvpRoute | undefined {
  return ROUTES.find((route) => route.id === id)
}

export function getPublicNavigationRoutes(): MvpRoute[] {
  return ROUTES.filter((route) => route.access === 'public')
}

export function getOperatorNavigationRoutes(): MvpRoute[] {
  return ROUTES.filter((route) => route.group === 'operator')
}
