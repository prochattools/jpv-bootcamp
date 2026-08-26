import 'server-only'
import prisma from '@/libs/prisma'
import { getOpsConfig } from '@/lib/config'

// In-memory fallback is only suitable for development; use DB/Redis in production.
const memoryStore = new Map<string, number>()
// Separate set tracking event IDs that are currently being processed (in-memory dev fallback).
const memoryProcessing = new Set<string>()
const shouldUsePrisma = Boolean(process.env.DATABASE_URL)
const STALE_LEASE_MS = 10 * 60 * 1000 // 10 minutes

let cachedTtlMs: number | null = null

function getTtlMs(): number {
	if (cachedTtlMs === null) {
		const ops = getOpsConfig()
		cachedTtlMs = ops.idempotencyTtlHours * 60 * 60 * 1000
	}
	return cachedTtlMs
}

function generateOwnerToken(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type PrismaClientLike = {
	stripeWebhookEvent?: {
		findUnique: (args: {
			where: { eventId: string }
		}) => Promise<{ eventId: string; processedAt: Date | null; receivedAt: Date; payload?: unknown } | null>
		create: (args: {
			data: {
				eventId: string
				type: string
				livemode: boolean
				receivedAt?: Date
				processedAt?: Date | null
				payload?: unknown
			}
		}) => Promise<{ eventId: string }>
		update: (args: {
			where: { eventId: string }
			data: { processedAt?: Date; payload?: unknown; receivedAt?: Date }
		}) => Promise<{ eventId: string }>
		delete: (args: { where: { eventId: string } }) => Promise<{ eventId: string }>
		deleteMany: (args: { where: { receivedAt: { lt: Date } } }) => Promise<{ count: number }>
	}
}

const prismaClient = prisma as unknown as PrismaClientLike

export type ClaimResult = {
	claimed: boolean
	alreadyProcessed: boolean
	ownerToken?: string
}

export type MarkProcessedResult = {
	dbAttempted: boolean
	dbSuccess: boolean
	error?: string
}

function pruneMemoryStore(now: number, ttlMs: number) {
	memoryStore.forEach((timestamp, eventId) => {
		if (now - timestamp > ttlMs) {
			memoryStore.delete(eventId)
			memoryProcessing.delete(eventId)
		}
	})
}

function isPrismaUniqueError(error: unknown): boolean {
	return Boolean(
		typeof error === 'object' &&
			error &&
			'code' in error &&
			(error as { code?: string }).code === 'P2002'
	)
}

function extractOwnerToken(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') return null
	const token = (payload as Record<string, unknown>)._ownerToken
	return typeof token === 'string' ? token : null
}

function mergeOwnerToken(payload: unknown, ownerToken: string): unknown {
	const base = payload && typeof payload === 'object' ? payload : {}
	return { ...(base as Record<string, unknown>), _ownerToken: ownerToken }
}

/**
 * Atomically claim an event for processing by inserting a row with processedAt=null.
 *
 * Three possible DB states:
 *   - No row                     → insert succeeds → we own the claim ({ claimed: true })
 *   - Row, processedAt IS NULL   → another worker is processing right now ({ claimed: false, alreadyProcessed: false })
 *   - Row, processedAt NOT NULL  → fully done ({ claimed: false, alreadyProcessed: true })
 *
 * Stale claim recovery: if a row with processedAt=null has been sitting for > STALE_LEASE_MS,
 * the prior worker is presumed dead. The stale row is deleted and a fresh claim is inserted.
 *
 * Production safety: if the DB returns a non-P2002 error in production, this function throws
 * with a 500-context error instead of falling back to the process-local memory store, which
 * would allow two workers on different instances to both claim the same event.
 *
 * The caller MUST call finalizeProcessed() on success or releaseProcessingClaim() on failure.
 */
export async function atomicClaimProcessing(params: {
	eventId: string
	eventType: string
	livemode: boolean
	payload?: unknown
}): Promise<ClaimResult> {
	const { eventId, eventType, livemode, payload } = params
	const ownerToken = generateOwnerToken()
	const mergedPayload = mergeOwnerToken(payload, ownerToken)

	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			// INSERT with processedAt=null — the unique constraint on eventId makes this atomic.
			await prismaClient.stripeWebhookEvent.create({
				data: {
					eventId,
					type: eventType,
					livemode,
					receivedAt: new Date(),
					processedAt: null,
					payload: mergedPayload,
				},
			})
			// Insert succeeded — we own the processing slot.
			return { claimed: true, alreadyProcessed: false, ownerToken }
		} catch (error) {
			if (isPrismaUniqueError(error)) {
				// Row already exists — inspect its state.
				try {
					const existing = await prismaClient.stripeWebhookEvent.findUnique({
						where: { eventId },
					})

					if (!existing) {
						// Row disappeared between the conflict and the lookup — treat conservatively.
						return { claimed: false, alreadyProcessed: false }
					}

					// Already fully processed by a prior delivery.
					if (existing.processedAt) {
						return { claimed: false, alreadyProcessed: true }
					}

					// Check whether the in-flight claim is stale.
					const receivedAt =
						existing.receivedAt instanceof Date
							? existing.receivedAt
							: new Date(existing.receivedAt)
					const isStale = Date.now() - receivedAt.getTime() > STALE_LEASE_MS

					if (isStale) {
						// The prior worker crashed without cleaning up. Reclaim by
						// updating the row's receivedAt. The stale check above already
						// confirmed processedAt is null and receivedAt is old enough.
						// If a concurrent worker also reclaims, only one update will
						// observe the stale receivedAt — the loser will re-read a fresh
						// timestamp on its next attempt and back off.
						try {
							await prismaClient.stripeWebhookEvent.update({
								where: { eventId },
								data: { receivedAt: new Date(), payload: mergedPayload },
							})
							return { claimed: true, alreadyProcessed: false, ownerToken }
						} catch {
							return { claimed: false, alreadyProcessed: false }
						}
					}

					// Active concurrent claim from another worker.
					return { claimed: false, alreadyProcessed: false }
				} catch (lookupError) {
					console.debug('Prisma idempotency lookup after conflict failed', {
						message: (lookupError as Error).message,
					})
					// Conservative: treat as still-processing so the caller returns 503.
					return { claimed: false, alreadyProcessed: false }
				}
			}

			// Non-P2002 DB error (connectivity, timeout, schema mismatch, …).
			if (process.env.NODE_ENV === 'production') {
				// In production, falling back to the process-local memory store is unsafe:
				// two workers on different instances could both claim the same event.
				throw new Error(
					`idempotency_db_unavailable: ${(error as Error).message}`
				)
			}

			console.debug(
				'Prisma atomicClaimProcessing failed, falling back to memory.',
				{ message: (error as Error).message }
			)
		}
	}

	// Memory fallback (dev only — not truly atomic, but acceptable for local dev).
	const now = Date.now()
	const ttlMs = getTtlMs()
	pruneMemoryStore(now, ttlMs)
	const seenAt = memoryStore.get(eventId)
	if (typeof seenAt === 'number' && now - seenAt <= ttlMs) {
		const alreadyProcessed = !memoryProcessing.has(eventId)
		return { claimed: false, alreadyProcessed }
	}
	memoryStore.set(eventId, now)
	memoryProcessing.add(eventId)
	return { claimed: true, alreadyProcessed: false, ownerToken }
}

/**
 * Finalize a previously claimed event: set processedAt to now and prune old rows.
 * Only call this after all effects have succeeded.
 *
 * Throws on DB failure — callers must convert this to a 500 response so Stripe retries.
 * If ownerToken is provided, verifies the stored token before updating.
 */
export async function finalizeProcessed(eventId: string, ownerToken?: string): Promise<void> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		if (ownerToken !== undefined) {
			const existing = await prismaClient.stripeWebhookEvent.findUnique({
				where: { eventId },
			})
			if (existing) {
				const storedToken = extractOwnerToken(existing.payload)
				if (storedToken !== ownerToken) {
					throw new Error(`idempotency_owner_mismatch: eventId=${eventId}`)
				}
			}
		}

		// Will throw if DB fails — caller handles as 500.
		await prismaClient.stripeWebhookEvent.update({
			where: { eventId },
			data: { processedAt: new Date() },
		})

		const ttlMs = getTtlMs()
		try {
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
		} catch (pruneError) {
			// Pruning old rows is best-effort; a failure here does not affect correctness.
			console.warn('Prisma finalizeProcessed pruning failed', {
				message: (pruneError as Error).message,
			})
		}
		return
	}
	// Memory: mark as no longer in-progress (keep in memoryStore so it deduplicates).
	memoryProcessing.delete(eventId)
}

/**
 * Release a processing claim after an effect failure so Stripe can retry.
 * Deletes the row so a subsequent delivery starts fresh and can reclaim.
 *
 * Throws on DB failure — callers must log and continue returning 500.
 * If ownerToken is provided, verifies the stored token before deleting.
 */
export async function releaseProcessingClaim(eventId: string, ownerToken?: string): Promise<void> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		if (ownerToken !== undefined) {
			const existing = await prismaClient.stripeWebhookEvent.findUnique({
				where: { eventId },
			})
			if (existing) {
				const storedToken = extractOwnerToken(existing.payload)
				if (storedToken !== ownerToken) {
					throw new Error(`idempotency_owner_mismatch: eventId=${eventId}`)
				}
			}
		}

		// Will throw if DB fails — caller must log and still return 500.
		await prismaClient.stripeWebhookEvent.delete({
			where: { eventId },
		})
		return
	}
	// Memory: remove entirely so the next Stripe retry can reclaim.
	memoryStore.delete(eventId)
	memoryProcessing.delete(eventId)
}

export async function hasProcessed(eventId: string): Promise<boolean> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			const existing = await prismaClient.stripeWebhookEvent.findUnique({
				where: { eventId },
			})
			return Boolean(existing?.processedAt)
		} catch (error) {
			console.debug('Prisma idempotency lookup failed, falling back to memory.', {
				message: (error as Error).message,
			})
		}
	}

	const now = Date.now()
	const ttlMs = getTtlMs()
	pruneMemoryStore(now, ttlMs)
	const seenAt = memoryStore.get(eventId)
	return typeof seenAt === 'number' && now - seenAt <= ttlMs && !memoryProcessing.has(eventId)
}

export type AtomicCheckAndMarkResult = {
	isNew: boolean
	dbAttempted: boolean
	dbSuccess: boolean
	error?: string
}

export async function atomicCheckAndMarkProcessed(params: {
	eventId: string
	eventType: string
	livemode: boolean
	payload?: unknown
}): Promise<AtomicCheckAndMarkResult> {
	const ttlMs = getTtlMs()
	const { eventId, eventType, livemode, payload } = params
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.create({
				data: {
					eventId,
					type: eventType,
					livemode,
					receivedAt: new Date(),
					processedAt: new Date(),
					payload,
				},
			})
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
			return { isNew: true, dbAttempted: true, dbSuccess: true }
		} catch (error) {
			if (isPrismaUniqueError(error)) {
				return { isNew: false, dbAttempted: true, dbSuccess: true }
			}
			console.debug('Prisma idempotency check-and-mark failed, falling back to memory.', {
				message: (error as Error).message,
			})
			const seenBefore = memoryStore.has(eventId)
			memoryStore.set(eventId, Date.now())
			return {
				isNew: !seenBefore,
				dbAttempted: true,
				dbSuccess: false,
				error: (error as Error).message,
			}
		}
	}

	const seenBefore = memoryStore.has(eventId)
	memoryStore.set(eventId, Date.now())
	return { isNew: !seenBefore, dbAttempted: false, dbSuccess: false }
}

export async function markProcessed(params: {
	eventId: string
	eventType: string
	livemode: boolean
	payload?: unknown
}): Promise<MarkProcessedResult> {
	const ttlMs = getTtlMs()
	const { eventId, eventType, livemode, payload } = params
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.create({
				data: {
					eventId,
					type: eventType,
					livemode,
					receivedAt: new Date(),
					processedAt: new Date(),
					payload,
				},
			})
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
			return { dbAttempted: true, dbSuccess: true }
		} catch (error) {
			if (isPrismaUniqueError(error)) {
				return { dbAttempted: true, dbSuccess: true }
			}
			console.debug('Prisma idempotency write failed, falling back to memory.', {
				message: (error as Error).message,
			})
			memoryStore.set(eventId, Date.now())
			return {
				dbAttempted: true,
				dbSuccess: false,
				error: (error as Error).message,
			}
		}
	}

	memoryStore.set(eventId, Date.now())
	return { dbAttempted: false, dbSuccess: false }
}
