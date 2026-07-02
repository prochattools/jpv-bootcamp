import { getPayload } from 'payload'

import { resolveMemberVerificationPublicBaseUrl } from '@/lib/auth/memberEmailVerificationApplication'
import {
  createPayloadMemberAccountActionService,
  createPostgresAtomicMemberAccountActionStore,
} from '@/lib/auth/payloadMemberAccountActions'
import { inviteMember } from '@/lib/members/inviteMember'
import { handleMemberInvitationRequest } from '@/lib/members/memberInvitationHttp'
import type { PayloadCourseWriteAPI, PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'
import payloadConfig from '@/payload.config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config: payloadConfig })

  return handleMemberInvitationRequest(request, {
    async authenticate(authRequest) {
      const auth = await payload.auth({ headers: authRequest.headers })
      const administrator = auth.user as {
        id?: string | number
        collection?: string
      } | null | undefined
      if (!administrator?.id || !administrator.collection) return null
      return {
        id: administrator.id,
        collection: administrator.collection,
      }
    },

    async invite(input) {
      const payloadApi = payload as unknown as PayloadCourseWriteAPI
      const actions = createPayloadMemberAccountActionService({
        payload: payloadApi,
        atomicStore: createPostgresAtomicMemberAccountActionStore(payloadApi),
        publicBaseUrl: resolveMemberVerificationPublicBaseUrl(),
      })
      return inviteMember(payload as unknown as PayloadMemberAuthAPI, actions, input)
    },
  })
}
