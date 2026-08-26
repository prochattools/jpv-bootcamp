import { getPayloadMemberEmailVerificationService } from '@/lib/auth/memberEmailVerificationApplication'
import {
  GENERIC_VERIFICATION_REQUEST_MESSAGE,
  handleMemberEmailVerificationResend,
} from '@/lib/auth/memberEmailVerificationHttp'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  try {
    const service = await getPayloadMemberEmailVerificationService()
    return handleMemberEmailVerificationResend(request, service)
  } catch {
    return Response.json(
      {
        accepted: true,
        message: GENERIC_VERIFICATION_REQUEST_MESSAGE,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
