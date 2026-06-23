import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { ForgotPasswordForm } from '@/components/member/PasswordWorkflowForms'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

export const metadata = {
  title: 'Forgot Password | JPV Bootcamp',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function ForgotPasswordPage() {
  const session = await resolvePayloadRequestSession(await headers())
  if (session.member?.id) redirect('/portal')

  return <ForgotPasswordForm />
}
