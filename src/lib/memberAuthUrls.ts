/**
 * Build the public member password-reset URL from the member portal URL.
 *
 * PORTAL_URL points at `/portal`, while password recovery is intentionally a
 * public route at `/forgot-password`. Keeping that distinction in one helper
 * prevents onboarding and sponsored-member emails from linking to a route
 * that does not exist.
 */
export function buildMemberForgotPasswordUrl(portalUrl: string): string {
	const url = new URL(portalUrl)
	const normalizedPath = url.pathname.replace(/\/+$/, '')
	const appPath = normalizedPath.endsWith('/portal')
		? normalizedPath.slice(0, -'/portal'.length)
		: normalizedPath

	url.pathname = `${appPath || ''}/forgot-password`
	url.search = ''
	url.hash = ''

	return url.toString().replace(/\/$/, '')
}
