import { renderBrandedEmail } from '@/lib/communications/brandedEmail'

export type MightyAccessReadyEmailContent = {
	subject: string
	text: string
	html: string
	from: string
	replyTo: string
}

export function buildMightyAccessReadyEmailContent(params: {
	email: string
	loginUrl: string
	from: string
	replyTo: string
}): MightyAccessReadyEmailContent {
	const loginUrl = params.loginUrl.trim()
	const recipient = params.email.trim()
	const greeting = recipient ? `Your JPV membership is ready, ${recipient}.` : 'Your JPV membership is ready.'
	const text = [
		greeting,
		'',
		'Your Mighty community access is ready.',
		`Sign in to Mighty here: ${loginUrl}`,
		`Use this email address to sign in: ${recipient || 'the email address used for your membership'}`,
		'Mighty will guide you through first-time authentication and password setup when needed.',
		'If you cannot sign in, contact support by replying to this email.',
		'',
		`Support: ${params.replyTo}`,
	].join('\n')
	const escapedGreeting = greeting.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}[character] ?? character))
	const html = renderBrandedEmail({
		preheader: 'Your JPV Mighty community access is ready.',
		heading: 'Your Mighty access is ready',
		bodyHtml: `<p style="margin:0 0 16px">${escapedGreeting}</p><p style="margin:0 0 16px">Your Mighty community access is ready. Use the email address associated with your membership to sign in. Mighty will guide you through first-time authentication and password setup when needed.</p><p style="margin:0">If you cannot sign in, contact support by replying to this email.</p>`,
		actions: [{ label: 'Sign in to Mighty', url: loginUrl }],
	})
	return {
		subject: 'Your JPV Bootcamp access is ready',
		text,
		html,
		from: params.from,
		replyTo: params.replyTo,
	}
}
