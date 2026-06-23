import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { ResetPasswordForm } from '@/components/member/PasswordWorkflowForms'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

export const metadata = {
  title: 'Reset Password | JPV Bootcamp',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const [session, params] = await Promise.all([
    resolvePayloadRequestSession(await headers()),
    searchParams,
  ])
  if (session.member?.id) redirect('/portal')

  return <ResetPasswordForm token={firstValue(params?.token)} />
}
