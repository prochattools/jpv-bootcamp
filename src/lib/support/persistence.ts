import 'server-only'

import prisma from '@/libs/prisma'
import type {
  SupportRequestCreateData,
  SupportRequestRecord,
  SupportRequestUpdateData,
} from '@/lib/support/supportIntake'

/**
 * Prisma support_requests is the canonical intake and operator-review ledger.
 * Keep its persistence behind this server-only boundary so transports compose
 * the intake/review domain without owning database mutations.
 */
export async function createSupportRequest(
  data: SupportRequestCreateData,
): Promise<SupportRequestRecord> {
  return prisma.supportRequest.create({ data })
}

export async function updateSupportRequest(
  id: string,
  data: SupportRequestUpdateData,
): Promise<void> {
  await prisma.supportRequest.update({ where: { id }, data })
}

export async function listSupportRequests() {
  return prisma.supportRequest.findMany({
    orderBy: [{ reviewStatus: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })
}

export async function setSupportReviewStatus(params: {
  requestId: string
  reviewStatus: 'pending' | 'in_review' | 'resolved'
  reviewedByAccountId: number
}): Promise<void> {
  await prisma.supportRequest.update({
    where: { id: params.requestId },
    data: {
      reviewStatus: params.reviewStatus,
      reviewedAt: params.reviewStatus === 'pending' ? null : new Date(),
      reviewedByAccountId: params.reviewStatus === 'pending' ? null : params.reviewedByAccountId,
    },
  })
}
