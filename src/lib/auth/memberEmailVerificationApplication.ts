import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

import {
  createPayloadMemberEmailVerificationService,
  createPostgresAtomicVerificationStore,
} from './payloadMemberEmailVerification'

export function resolveMemberVerificationPublicBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured =
    env.APP_PUBLIC_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    env.PAYLOAD_SERVER_URL ||
    env.NEXT_PUBLIC_SERVER_URL ||
    env.NEXT_PUBLIC_APP_DOMAIN

  if (!configured) {
    throw new Error('A public application URL is required for member email verification')
  }

  const candidate = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  const url = new URL(candidate)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Member email verification requires an HTTP(S) public application URL')
  }
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export async function getPayloadMemberEmailVerificationService() {
  const [{ getPayload }, { default: payloadConfig }] = await Promise.all([
    import('payload'),
    import('@/payload.config'),
  ])
  const payload = await getPayload({ config: payloadConfig })
  const payloadApi = payload as unknown as PayloadCourseWriteAPI
  return createPayloadMemberEmailVerificationService({
    payload: payloadApi,
    atomicStore: createPostgresAtomicVerificationStore(payloadApi),
    publicBaseUrl: resolveMemberVerificationPublicBaseUrl(),
  })
}
