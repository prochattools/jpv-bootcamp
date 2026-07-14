import { redirect } from 'next/navigation'

type LearnAccountPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function LearnAccountPage({ searchParams }: LearnAccountPageProps) {
  const params = await searchParams
  const redirectParams = new URLSearchParams()

  if (firstParam(params.updated) === '1') {
    redirectParams.set('updated', '1')
  }

  if (firstParam(params.error) === 'display-name') {
    redirectParams.set('error', 'display-name')
  }

  const destination = redirectParams.size > 0 ? `/portal/account?${redirectParams.toString()}` : '/portal/account'
  redirect(destination)
}
