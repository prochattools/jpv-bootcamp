import {
  getPayloadMemberEmailVerificationService,
  resolveMemberVerificationPublicBaseUrl,
} from '@/lib/auth/memberEmailVerificationApplication'
import { handleMemberEmailVerificationComplete } from '@/lib/auth/memberEmailVerificationHttp'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  try {
    const service = await getPayloadMemberEmailVerificationService()
    return handleMemberEmailVerificationComplete(request, service, {
      publicBaseUrl: resolveMemberVerificationPublicBaseUrl(),
    })
  } catch {
    const url = new URL('/portal', resolveMemberVerificationPublicBaseUrl())
    url.searchParams.set('mode', 'login')
    url.searchParams.set('verification', 'invalid')
    return Response.redirect(url, 303)
  }
}
