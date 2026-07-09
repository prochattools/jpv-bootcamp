export type MvpRouteGroup = 'public' | 'member_preview' | 'operator' | 'billing_membership'

export type MvpRouteStatus = 'ready_for_testing' | 'preview' | 'auth_required' | 'manual_review'

export type MvpRouteAccess = 'public' | 'controlled_free' | 'pro' | 'operator' | 'auth_required'

export type MvpRouteKind = 'canonical' | 'compatibility_redirect'

export type MvpRoute = {
  id: string
  label: string
  href: string
  summary: string
  group: MvpRouteGroup
  status: MvpRouteStatus
  access: MvpRouteAccess
  kind: MvpRouteKind
  canonicalHref?: string
}

const ROUTES: MvpRoute[] = [
  {
    id: 'portal',
    label: 'Member portal',
    href: '/portal',
    summary: 'Real authenticated member portal. Requires Payload DB-backed session.',
    group: 'member_preview',
    status: 'auth_required',
    access: 'auth_required',
    kind: 'canonical',
  },
  {
    id: 'portal-programme',
    label: 'Programme',
    href: '/portal/programme',
    summary: 'Course programme catalog with eight weekly modules, descriptions, and session counts. Auth-required for portal members.',
    group: 'member_preview',
    status: 'preview',
    access: 'auth_required',
    kind: 'canonical',
  },
  {
    id: 'portal-community',
    label: 'Community',
    href: '/portal/community',
    summary: 'Community spaces, forums, and room previews. Auth-required for portal members. Full access requires Pro membership.',
    group: 'member_preview',
    status: 'preview',
    access: 'auth_required',
    kind: 'canonical',
  },
  {
    id: 'portal-support',
    label: 'Support & Pay It Forward',
    href: '/portal/support',
    summary: 'Sponsor a Free access seat or apply for controlled Free access after manual review.',
    group: 'public',
    status: 'ready_for_testing',
    access: 'public',
    kind: 'canonical',
  },
  {
    id: 'portal-partner-referral',
    label: 'Partner Referral',
    href: '/portal/partner-referral',
    summary: 'Apply through a partner referral to join the JPV Bootcamp community.',
    group: 'public',
    status: 'ready_for_testing',
    access: 'public',
    kind: 'canonical',
  },
  {
    id: 'upgrade',
    label: 'Pro Membership',
    href: '/upgrade',
    summary: 'Pro membership pricing: £80/month or £880/year. Full course access, mentorship, and community.',
    group: 'billing_membership',
    status: 'preview',
    access: 'public',
    kind: 'canonical',
  },
  {
    id: 'admin-review',
    label: 'Admin review dashboard',
    href: '/admin/review',
    summary: 'Operator review dashboard with section status, blockers, actions, and export preview.',
    group: 'operator',
    status: 'preview',
    access: 'operator',
    kind: 'canonical',
  },
  {
    id: 'dashboard',
    label: 'Dashboard (compatibility redirect)',
    href: '/dashboard',
    summary: 'Compatibility redirect to /portal. Previously the public preview dashboard.',
    group: 'member_preview',
    status: 'preview',
    access: 'public',
    kind: 'compatibility_redirect',
    canonicalHref: '/portal',
  },
  {
    id: 'programme',
    label: 'Programme (compatibility redirect)',
    href: '/programme',
    summary: 'Compatibility redirect to /portal/programme.',
    group: 'public',
    status: 'preview',
    access: 'public',
    kind: 'compatibility_redirect',
    canonicalHref: '/portal/programme',
  },
  {
    id: 'community',
    label: 'Community (compatibility redirect)',
    href: '/community',
    summary: 'Compatibility redirect to /portal/community.',
    group: 'public',
    status: 'preview',
    access: 'public',
    kind: 'compatibility_redirect',
    canonicalHref: '/portal/community',
  },
  {
    id: 'support',
    label: 'Support (compatibility redirect)',
    href: '/support',
    summary: 'Compatibility redirect to /portal/support.',
    group: 'public',
    status: 'ready_for_testing',
    access: 'public',
    kind: 'compatibility_redirect',
    canonicalHref: '/portal/support',
  },
  {
    id: 'partner-referral',
    label: 'Partner Referral (compatibility redirect)',
    href: '/partner-referral',
    summary: 'Compatibility redirect to /portal/partner-referral.',
    group: 'public',
    status: 'ready_for_testing',
    access: 'public',
    kind: 'compatibility_redirect',
    canonicalHref: '/portal/partner-referral',
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

export function getCanonicalRoutes(): MvpRoute[] {
  return ROUTES.filter((route) => route.kind === 'canonical')
}

export function getCompatibilityRedirects(): MvpRoute[] {
  return ROUTES.filter((route) => route.kind === 'compatibility_redirect')
}
