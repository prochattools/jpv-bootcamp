import config from '@payload-config'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'

function logoutRedirect(request: NextRequest): URL {
  const target = new URL('/admin/login', request.url)
  target.searchParams.set('loggedOut', '1')
  return target
}

function expireCookie(response: NextResponse, name: string): void {
  response.cookies.set({
    name,
    value: '',
    expires: new Date(0),
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  })
}

async function payloadCookiePrefix(): Promise<string> {
  const payload = await getPayload({ config })
  return payload.config.cookiePrefix
}

async function clearPayloadAuthCookies(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(logoutRedirect(request))
  const cookieStore = await cookies()
  const prefix = await payloadCookiePrefix()

  const names = new Set<string>()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(prefix)) {
      names.add(cookie.name)
    }
  }

  // Payload's built-in admin logout deletes only the first auth cookie it finds. In this app,
  // a logged-in member who opens /admin can land on /admin/unauthorized and remain stuck behind
  // the member auth cookie. Clear all Payload-prefixed auth cookies so the administrator login
  // screen can be reached cleanly.
  names.add(`${prefix}-token`)

  for (const name of names) {
    expireCookie(response, name)
  }

  return response
}

export async function GET(request: NextRequest) {
  return clearPayloadAuthCookies(request)
}

export async function POST(request: NextRequest) {
  return clearPayloadAuthCookies(request)
}
