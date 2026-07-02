import type { PayloadCourseWriteAPI, PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'

import { resolveMemberVerificationPublicBaseUrl } from './memberEmailVerificationApplication'
import {
  createPayloadMemberAccountActionService,
  createPostgresAtomicMemberAccountActionStore,
} from './payloadMemberAccountActions'

export async function getPayloadMemberAccountActionContext() {
  const [{ getPayload }, { default: payloadConfig }] = await Promise.all([
    import('payload'),
    import('@/payload.config'),
  ])
  const payload = await getPayload({ config: payloadConfig })
  const payloadApi = payload as unknown as PayloadCourseWriteAPI
  const service = createPayloadMemberAccountActionService({
    payload: payloadApi,
    atomicStore: createPostgresAtomicMemberAccountActionStore(payloadApi),
    publicBaseUrl: resolveMemberVerificationPublicBaseUrl(),
  })

  return {
    payload: payload as unknown as PayloadMemberAuthAPI,
    service,
    publicBaseUrl: resolveMemberVerificationPublicBaseUrl(),
  }
}
