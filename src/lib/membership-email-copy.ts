import type { Plan } from '@/lib/plans'

export type MembershipEmailVariant = 'welcome' | 'upgrade'

export function getPlanLabel(_plan: Plan): string {
	return 'JPV Bootcamp membership'
}

export function getMembershipEmailIntro(params: {
	plan: Plan
	variant: MembershipEmailVariant
}): string {
	return params.variant === 'upgrade'
		? 'Your JPV Bootcamp membership has been updated.'
		: 'Your JPV Bootcamp account is activated. Here are your login details.'
}

export function getMembershipEmailIntroHtml(params: {
	plan: Plan
	variant: MembershipEmailVariant
}): string {
	return params.variant === 'upgrade'
		? 'Your JPV Bootcamp membership has been updated.'
		: 'Your JPV Bootcamp account is activated. Here are your login details.'
}
