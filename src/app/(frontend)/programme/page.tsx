import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ProgrammeRedirect() {
  redirect('/portal/programme')
}
