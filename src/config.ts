import type { ConfigProps } from '@/types/config'
import themes from 'daisyui/src/theming/themes'

const domainName =
	process.env.NEXT_PUBLIC_APP_DOMAIN ??
	process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '') ??
	'jpvbootcamp.com'

const config: ConfigProps = {
	// REQUIRED
	appName: 'JPV • Jesus Property Venture',
	// REQUIRED: a short description of your app for SEO tags (can be overwritten)
	appDescription:
		'Members-only property investing bootcamp with coaching, tools, and a supportive community for ambitious deal makers.',
	appTagline: 'Train for Property Success with JPV',
	appPreheader: 'Learn a proven deal-making framework with mentors, templates, and real-world accountability.',
	// REQUIRED (no https://, not trialing slash at the end, just the naked domain)
	domainName,
	colors: {
		// REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you any other theme than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
		theme: 'light',
		// REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). By default it takes the primary color from your DaisyUI theme (make sure to update your the theme name after "data-theme=")
		// OR you can just do this to use a custom color: main: "#f37055". HEX only.
		main: themes['light']['primary'],
	},
	resend: {
		// REQUIRED — Email 'From' field to be used when sending emails
		fromAdmin: `Your App <hello@yourdomain.com>`,
		// Email shown to customer if need support. Leave empty if not needed
		supportEmail: 'support@yourdomain.com',
		// When someone replies to supportEmail sent by the app, forward it to the email below (otherwise it's lost). If you set supportEmail to empty, this will be ignored.
		forwardRepliesTo: 'support@yourdomain.com',
		subjects: {
			welcomeEmail: 'Welcome! 🎉',
		},
	},
}

export default config
