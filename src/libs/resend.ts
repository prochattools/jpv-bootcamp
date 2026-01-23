import config from '@/config'
import { Resend } from 'resend'

class ResendService {
	private resend = new Resend(process.env.RESEND_API_KEY)

	private isNonWebhookEmailDisabled(): boolean {
		const value = process.env.DISABLE_NON_WEBHOOK_EMAILS ?? ''
		return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
	}

	public async sendWelcomeEmail(toMail: string, name?: string, source = 'signup') {
		console.info('email_attempt', {
			at: 'email_attempt',
			templateKey: 'newsletter_welcome',
			email: toMail,
			plan: null,
			eventId: null,
			eventType: null,
			subscriptionId: null,
			customerId: null,
			source,
			dedupeKey: null,
			stackHint: 'libs/resend:sendWelcomeEmail',
		})

		if (this.isNonWebhookEmailDisabled()) {
			console.info('Non-webhook email skipped', {
				email: toMail,
				templateKey: 'newsletter_welcome',
				source,
			})
			return null
		}

		const { data, error } = await this.resend.emails.send({
			from: config.resend.fromAdmin,
			to: [toMail],
			replyTo: config.resend.forwardRepliesTo,
			subject: config.resend.subjects.welcomeEmail,
			html: `
				<h1>Welcome to ${config.appName}!</h1>
				<p>Hi ${name || 'there'},</p>
				<p>Thank you for subscribing to our updates. We'll keep you posted on our latest news and features.</p>
				<p>Best regards,<br>The ${config.appName} Team</p>
			`,
		})

		if (error) {
			throw error
		}

		return data
	}
}

export const resendService = new ResendService()
