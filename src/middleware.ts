import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sanitizePartnersToken } from '@/lib/partners-token-sanitize'
import { sanitizePathOnly, PARTNERS_DEFAULT_PATH } from '@/lib/partners-url'

// Simple middleware for landing page - no authentication needed
export function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname
	const isApiRoute = pathname.startsWith('/api')
	const isNextRoute = pathname.startsWith('/_next')
	const isPartnersRoute =
		pathname === '/partners' ||
		pathname.startsWith('/partners/') ||
		pathname.startsWith('/out/')
	const isPartnersSession = pathname === '/partners/session'
	if (request.headers.has('next-action')) {
		return new Response(null, { status: 204 })
	}

	if (request.method === 'POST' && !isApiRoute && !isNextRoute) {
		return new Response(null, { status: 204 })
	}

	if (isPartnersRoute) {
		const sessionCookie = request.cookies.get('partners_session')?.value ?? ''
		if (sessionCookie) {
			return NextResponse.next()
		}

		const tokenParam = request.nextUrl.searchParams.get('token')
		const token = sanitizePartnersToken(tokenParam)
		if (isPartnersSession) {
			if (token) {
				return NextResponse.next()
			}
			return NextResponse.redirect('https://portal.jpvbootcamp.com/go/partners')
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

		return NextResponse.redirect('https://portal.jpvbootcamp.com/go/partners')
	}

	return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
