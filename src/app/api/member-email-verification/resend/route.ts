import { getPayloadMemberEmailVerificationService } from '@/lib/auth/memberEmailVerificationApplication'
import { handleMemberEmailVerificationResend } from '@/lib/auth/memberEmailVerificationHttp'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  try {
    const service = await getPayloadMemberEmailVerificationService()
    return handleMemberEmailVerificationResend(request, service)
  } catch {
    return Response.json(
      {
        accepted: true,
        message: 'If an eligible account exists, a verification email will be sent shortly.',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
