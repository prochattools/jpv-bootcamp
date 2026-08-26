import type { Plan } from '@/lib/plans'

export type MembershipEmailVariant = 'welcome' | 'upgrade'

export function getPlanLabel(plan: Plan): string {
	return 'Pro'
}

export function getMembershipEmailIntro(params: {
	plan: Plan
	variant: MembershipEmailVariant
}): string {
	const planLabel = getPlanLabel(params.plan)
	return params.variant === 'upgrade'
		? `You've been upgraded to ${planLabel}.`
		: `Your ${planLabel} plan is active.`
}

export function getMembershipEmailIntroHtml(params: {
	plan: Plan
	variant: MembershipEmailVariant
}): string {
	const planLabel = getPlanLabel(params.plan)
	return params.variant === 'upgrade'
		? `You've been upgraded to <strong>${planLabel}</strong>.`
		: `Your <strong>${planLabel}</strong> plan is active.`
}
