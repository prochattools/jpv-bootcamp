import type {
  MemberAccountActionPurpose,
  MemberAccountActionRecord,
  MemberAccountActionRepository,
} from '../../src/lib/auth/memberAccountActions'

export class MemoryMemberAccountActionRepository implements MemberAccountActionRepository {
  readonly records: MemberAccountActionRecord[] = []
  readonly deliveries: Array<Record<string, unknown>> = []

  constructor(private readonly now: () => Date = () => new Date()) {}

  async findActiveAction(memberId: string, purpose: MemberAccountActionPurpose) {
    return this.records.find(
      (record) =>
        record.memberId === memberId &&
        record.purpose === purpose &&
        !record.consumedAt &&
        !record.invalidatedAt,
    ) ?? null
  }

  async replaceActiveAction(record: MemberAccountActionRecord) {
    const currentTime = this.now().getTime()
    for (const existing of this.records) {
      if (
        existing.memberId === record.memberId &&
        existing.purpose === record.purpose &&
        !existing.consumedAt &&
        !existing.invalidatedAt
      ) {
        if (
          existing.resultFingerprint ||
          (
            existing.reservationNonce &&
            existing.leaseExpiresAt &&
            new Date(existing.leaseExpiresAt).getTime() > currentTime
          )
        ) {
          throw new Error('Member account action cannot be replaced while reserved')
        }
        existing.invalidatedAt = record.createdAt
      }
    }
    this.records.push(structuredClone(record))
  }

  async findActionByDigest(tokenDigest: string, purpose: MemberAccountActionPurpose) {
    return this.records.find(
      (record) => record.tokenDigest === tokenDigest && record.purpose === purpose,
    ) ?? null
  }

  async reserveAction(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
    leaseDurationMs: number
  }) {
    const current = this.now()
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === input.tokenDigest &&
        candidate.purpose === input.purpose &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        new Date(candidate.expiresAt).getTime() > current.getTime(),
    )
    if (!record) return null
    const activeLease =
      record.reservationNonce &&
      record.leaseExpiresAt &&
      new Date(record.leaseExpiresAt).getTime() > current.getTime()
    if (activeLease) return null

    const reclaimed = Boolean(record.reservationNonce)
    record.reservationNonce = input.reservationNonce
    record.reservedAt = current.toISOString()
    record.leaseExpiresAt = new Date(current.getTime() + input.leaseDurationMs).toISOString()
    return {
      memberId: record.memberId,
      email: record.email,
      reservationNonce: input.reservationNonce,
      reservedAt: record.reservedAt,
      leaseExpiresAt: record.leaseExpiresAt,
      resultFingerprint: record.resultFingerprint,
      reclaimed,
    }
  }

  async markMutationStarted(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
    resultFingerprint: string
  }) {
    const current = this.now()
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === input.tokenDigest &&
        candidate.purpose === input.purpose &&
        candidate.reservationNonce === input.reservationNonce &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        Boolean(candidate.leaseExpiresAt) &&
        new Date(candidate.leaseExpiresAt as string).getTime() > current.getTime(),
    )
    if (!record) return false
    if (record.resultFingerprint && record.resultFingerprint !== input.resultFingerprint) return false
    record.resultFingerprint = input.resultFingerprint
    return true
  }

  async finalizeAction(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
    resultFingerprint: string
  }) {
    const current = this.now()
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === input.tokenDigest &&
        candidate.purpose === input.purpose &&
        candidate.reservationNonce === input.reservationNonce &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        Boolean(candidate.leaseExpiresAt) &&
        new Date(candidate.leaseExpiresAt as string).getTime() > current.getTime(),
    )
    if (!record) return null
    record.consumedAt = current.toISOString()
    record.resultFingerprint = input.resultFingerprint
    record.reservationNonce = undefined
    record.reservedAt = undefined
    record.leaseExpiresAt = undefined
    return {
      memberId: record.memberId,
      email: record.email,
      resultFingerprint: input.resultFingerprint,
      consumedAt: record.consumedAt,
    }
  }

  async releaseAction(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
  }) {
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === input.tokenDigest &&
        candidate.purpose === input.purpose &&
        candidate.reservationNonce === input.reservationNonce &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt,
    )
    if (!record) return false
    record.reservationNonce = undefined
    record.reservedAt = undefined
    record.leaseExpiresAt = undefined
    record.resultFingerprint = undefined
    return true
  }

  async findCompletedAction(tokenDigest: string, purpose: MemberAccountActionPurpose) {
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === tokenDigest &&
        candidate.purpose === purpose &&
        Boolean(candidate.consumedAt) &&
        Boolean(candidate.resultFingerprint),
    )
    if (!record || !record.consumedAt || !record.resultFingerprint) return null
    return {
      memberId: record.memberId,
      email: record.email,
      resultFingerprint: record.resultFingerprint,
      consumedAt: record.consumedAt,
    }
  }

  async recordDelivery(event: Record<string, unknown>) {
    this.deliveries.push(structuredClone(event))
  }
}
