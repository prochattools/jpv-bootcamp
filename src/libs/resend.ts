import config from '@/config'
import { Resend } from 'resend'

class ResendService {
	private resend = new Resend(process.env.RESEND_API_KEY)

	public async sendWelcomeEmail(toMail: string, name?: string) {
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
