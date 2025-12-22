import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple middleware for landing page - no authentication needed
export function middleware(request: NextRequest) {
  const actionId = request.headers.get('next-action')
  if (actionId) {
    return NextResponse.json(
      { error: 'Server Actions are not enabled for this deployment.' },
      { status: 409 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
