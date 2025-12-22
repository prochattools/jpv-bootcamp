import 'server-only'
import { Resend } from 'resend'
import { config } from '@/lib/config'
import type { Plan } from '@/lib/plans'

const resend = new Resend(config.email.resendApiKey)

const SUBJECT = 'Your JPV Bootcamp access is ready'

function getPlanLabel(plan: Plan): string {
	return plan === 'vip' ? 'VIP' : 'Pro'
}

export async function sendWelcomeEmail({
	to,
	plan,
}: {
	to: string
	plan: Plan
}): Promise<void> {
	const planLabel = getPlanLabel(plan)
	const text = [
		`Your ${planLabel} plan is active.`,
		'',
		`Log in here: ${config.email.portalLoginUrl}`,
		`Set or reset your password here: ${config.email.portalSetPasswordUrl}`,
		'',
		`If you need help, reply to this email: ${config.email.replyTo}`,
	].join('\n')

	const html = `
		<p>Your <strong>${planLabel}</strong> plan is active.</p>
		<p><a href="${config.email.portalLoginUrl}">Log in to the portal</a></p>
		<p><a href="${config.email.portalSetPasswordUrl}">Set or reset your password</a></p>
		<p>If you need help, reply to this email: ${config.email.replyTo}</p>
	`

	const { error } = await resend.emails.send({
		from: config.email.from,
		to: [to],
		replyTo: config.email.replyTo,
		subject: SUBJECT,
		text,
		html,
	})

	if (error) {
		throw error
	}
}
