import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple middleware for landing page - no authentication needed
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')
  const isNextRoute = pathname.startsWith('/_next')
  if (request.method === 'POST' && !isApiRoute && !isNextRoute) {
    return NextResponse.json(
      { error: 'POST requests to app routes are not supported.' },
      { status: 405 }
    )
  }

  if (request.headers.has('next-action')) {
    const headers = new Headers(request.headers)
    headers.delete('next-action')
    return NextResponse.next({ request: { headers } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
