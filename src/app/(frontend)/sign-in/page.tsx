import { redirect } from 'next/navigation'

type SignInSearchParams = {
  next?: string | string[]
  redirect?: string | string[]
  verification?: string | string[]
  registration?: string | string[]
}

type SignInPageProps = {
  searchParams?: Promise<SignInSearchParams>
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | null): void {
  if (value) params.set(key, value)
}

/**
 * /sign-in compatibility redirect.
 *
 * The canonical sign-in entry point is /portal?mode=login.
 * This route exists so that external links and email templates that
 * reference /sign-in do not produce a 404.
 * All query parameters accepted by the login page are forwarded.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const target = new URLSearchParams({ mode: 'login' })
  appendIfPresent(target, 'next', firstValue(params?.next) ?? firstValue(params?.redirect))
  appendIfPresent(target, 'verification', firstValue(params?.verification))
  appendIfPresent(target, 'registration', firstValue(params?.registration))
  redirect(`/portal?${target.toString()}`)
}
