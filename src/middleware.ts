import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple middleware for landing page - no authentication needed
export function middleware(request: NextRequest) {
  // Add any custom headers or redirects here if needed
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}