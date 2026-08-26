import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sanitizePartnersToken } from '@/lib/partners-token-sanitize'
import { sanitizePathOnly, PARTNERS_DEFAULT_PATH } from '@/lib/partners-url'

// Simple middleware for landing page - no authentication needed
export function proxy(request: NextRequest) {
	const pathname = request.nextUrl.pathname
	const isApiRoute = pathname.startsWith('/api')
	const isNextRoute = pathname.startsWith('/_next')
	const isPayloadAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
	const isPortalRoute = pathname === '/portal' || pathname.startsWith('/portal/')
	const isPartnersRoute =
		pathname === '/partners' ||
		pathname.startsWith('/partners/') ||
		pathname.startsWith('/out/')
	const isPartnersSession = pathname === '/partners/session'

	// Block server actions on public routes only — portal and admin handle their own auth.
	// Portal server actions (community posts etc.) must pass through.
	if (request.headers.has('next-action') && !isPayloadAdminRoute && !isPortalRoute) {
		return new Response(null, { status: 204 })
	}

	if (request.method === 'POST' && !isApiRoute && !isNextRoute && !isPayloadAdminRoute && !isPortalRoute) {
		return new Response(null, { status: 204 })
	}

	if (isPartnersRoute) {
		const sessionCookie = request.cookies.get('partners_session')?.value ?? ''
		if (sessionCookie) {
			return NextResponse.next()
		}

		const tokenParam = request.nextUrl.searchParams.get('token')
		const token = sanitizePartnersToken(tokenParam)
		// The partners landing page is public. Only tokenized handoffs and
		// deeper partner paths require session establishment.
		if (pathname === PARTNERS_DEFAULT_PATH && !token) {
			return NextResponse.next()
		}
		if (isPartnersSession) {
			if (token) {
				return NextResponse.next()
			}
			return NextResponse.redirect(new URL('/partners', request.url))
		}
		if (token) {
			const redirectUrl = request.nextUrl.clone()
			redirectUrl.pathname = '/partners/session'
			redirectUrl.search = ''
			const nextPath = sanitizePathOnly(pathname, PARTNERS_DEFAULT_PATH)
			redirectUrl.searchParams.set('token', token)
			redirectUrl.searchParams.set('next', nextPath)
			return NextResponse.redirect(redirectUrl)
		}

		return NextResponse.redirect(new URL('/partners', request.url))
	}

	return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
