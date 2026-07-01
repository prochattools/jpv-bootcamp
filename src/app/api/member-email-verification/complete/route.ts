import { getPayloadMemberEmailVerificationService } from '@/lib/auth/memberEmailVerificationApplication'
import { handleMemberEmailVerificationComplete } from '@/lib/auth/memberEmailVerificationHttp'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  try {
    const service = await getPayloadMemberEmailVerificationService()
    return handleMemberEmailVerificationComplete(request, service)
  } catch {
    const url = new URL('/login', request.url)
    url.searchParams.set('verification', 'invalid')
    return Response.redirect(url, 303)
  }
}
