import { redirect } from 'next/navigation'

type SuccessPageProps = {
  searchParams?: Promise<{
    session_id?: string
  }>
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams
  const sessionId = params?.session_id
  const target = sessionId ? `/thank-you?session_id=${sessionId}` : '/thank-you'
  redirect(target)
}
