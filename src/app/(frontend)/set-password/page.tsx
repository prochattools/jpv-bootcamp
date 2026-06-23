import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { SetPasswordForm } from '@/components/member/PasswordWorkflowForms'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

type SetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

export const metadata = {
  title: 'Set Password | JPV Bootcamp',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const [session, params] = await Promise.all([
    resolvePayloadRequestSession(await headers()),
    searchParams,
  ])
  if (session.member?.id) redirect('/portal')

  return <SetPasswordForm token={firstValue(params?.token)} />
}
