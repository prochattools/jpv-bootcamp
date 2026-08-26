import { redirect } from 'next/navigation'

type LoginSearchParams = {
  next?: string | string[]
  redirect?: string | string[]
  verification?: string | string[]
  emailChange?: string | string[]
  registration?: string | string[]
}

type LoginPageProps = {
  searchParams?: Promise<LoginSearchParams>
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function appendIfPresent(params: URLSearchParams, key: string, value: string | null): void {
  if (value) params.set(key, value)
}

export default async function SharedLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const target = new URLSearchParams({ mode: 'login' })
  appendIfPresent(target, 'next', firstValue(params?.next) ?? firstValue(params?.redirect))
  appendIfPresent(target, 'verification', firstValue(params?.verification))
  appendIfPresent(target, 'emailChange', firstValue(params?.emailChange))
  appendIfPresent(target, 'registration', firstValue(params?.registration))
  redirect(`/portal?${target.toString()}`)
}
