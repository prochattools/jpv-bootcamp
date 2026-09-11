import { redirect } from 'next/navigation'

import { MIGHTY_STUDENT_LOGIN_URL } from '@/lib/mighty/studentLogin'

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/**
 * /sign-in compatibility redirect.
 *
 * The canonical student sign-in entry point is Mighty Networks.
 * Keep this compatibility route so historical links do not expose the
 * retiring custom student portal.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  await searchParams
  redirect(MIGHTY_STUDENT_LOGIN_URL)
}
