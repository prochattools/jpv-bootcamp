import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import config from '@payload-config'

const LOGOUT_DESTINATION = '/portal?mode=login&loggedOut=1'

function resolvePayloadCookiePrefix(): string {
  const configured = (config as { cookiePrefix?: unknown }).cookiePrefix
  return typeof configured === 'string' && configured.trim() ? configured.trim() : 'payload'
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

/**
 * Logs out either a member or an administrator from the shared portal entry
 * point. Payload's collection logout endpoints reject sessions belonging to a
 * different auth collection, so the portal must clear the shared auth cookie
 * namespace itself.
 */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json(
    { ok: true, destination: LOGOUT_DESTINATION },
    { headers: { 'Cache-Control': 'no-store' } },
  )
  const cookieStore = await cookies()
  const prefix = resolvePayloadCookiePrefix()
  const names = new Set<string>()

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(prefix)) names.add(cookie.name)
  }

  // Keep this explicit so logout also works when the token cookie is not
  // included in the request's parsed cookie list.
  names.add(`${prefix}-token`)

  for (const name of names) expireCookie(response, name)
  return response
}
