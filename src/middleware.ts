import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple middleware for landing page - no authentication needed
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')
  const isNextRoute = pathname.startsWith('/_next')
  if (request.headers.has('next-action')) {
    return new Response(null, { status: 204 })
  }

  if (request.method === 'POST' && !isApiRoute && !isNextRoute) {
    return new Response(null, { status: 204 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
