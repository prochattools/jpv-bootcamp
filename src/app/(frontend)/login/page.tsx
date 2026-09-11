import { redirect } from 'next/navigation'

import { MIGHTY_STUDENT_LOGIN_URL } from '@/lib/mighty/studentLogin'

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SharedLoginPage({ searchParams }: LoginPageProps) {
  await searchParams
  redirect(MIGHTY_STUDENT_LOGIN_URL)
}
