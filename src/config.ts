import themes from 'daisyui/src/theming/themes'

interface ConfigProps {
	appName: string
	appDescription: string
	domainName: string
	colors: {
		theme: string
		main: string
	}
	resend: {
		fromAdmin: string
		supportEmail: string
		forwardRepliesTo: string
		subjects: {
			welcomeEmail: string
		}
	}
}

const config: ConfigProps = {
	// REQUIRED
	appName: 'Your App Name',
	// REQUIRED: a short description of your app for SEO tags (can be overwritten)
	appDescription:
		'A clean, fast Next.js landing page boilerplate optimized for email collection and lead generation.',
	// REQUIRED (no https://, not trialing slash at the end, just the naked domain)
	domainName: 'yourdomain.com',
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
