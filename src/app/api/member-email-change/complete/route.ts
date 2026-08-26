import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { completeMemberEmailChange } from '@/lib/members/changeMemberEmail'
import { buildMemberEmailChangeLoginResultUrl } from '@/lib/members/memberEmailChangeRedirect'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token')
  if (!token || token.length < 20 || token.length > 512) {
    return Response.redirect(buildMemberEmailChangeLoginResultUrl(request, 'invalid'), 303)
  }

  try {
    const { payload, service, publicBaseUrl } = await getPayloadMemberAccountActionContext()
    const result = await completeMemberEmailChange(payload, service, token, publicBaseUrl)
    return Response.redirect(
      buildMemberEmailChangeLoginResultUrl(request, result.ok ? 'success' : 'invalid'),
      303,
    )
  } catch {
    return Response.redirect(buildMemberEmailChangeLoginResultUrl(request, 'invalid'), 303)
  }
}
