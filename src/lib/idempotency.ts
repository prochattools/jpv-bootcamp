import 'server-only'
import prisma from '@/libs/prisma'
import { getOpsConfig } from '@/lib/config'

// In-memory fallback is only suitable for development; use DB/Redis in production.
const memoryStore = new Map<string, number>()
// Separate set tracking event IDs that are currently being processed (in-memory dev fallback).
const memoryProcessing = new Set<string>()
const shouldUsePrisma = Boolean(process.env.DATABASE_URL)
let cachedTtlMs: number | null = null

function getTtlMs(): number {
	if (cachedTtlMs === null) {
		const ops = getOpsConfig()
		cachedTtlMs = ops.idempotencyTtlHours * 60 * 60 * 1000
	}
	return cachedTtlMs
}

type PrismaClientLike = {
	stripeWebhookEvent?: {
		findUnique: (args: {
			where: { eventId: string }
		}) => Promise<{ eventId: string; processedAt: Date | null } | null>
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
			data: { processedAt: Date }
		}) => Promise<{ eventId: string }>
		delete: (args: { where: { eventId: string } }) => Promise<{ eventId: string }>
		deleteMany: (args: { where: { receivedAt: { lt: Date } } }) => Promise<{ count: number }>
	}
}

const prismaClient = prisma as unknown as PrismaClientLike

export type MarkProcessedResult = {
	dbAttempted: boolean
	dbSuccess: boolean
	error?: string
}

export type ClaimResult = {
	claimed: boolean
	alreadyProcessed: boolean
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

/**
 * Atomically claim an event for processing by inserting a row with processedAt=null.
 *
 * Three possible DB states:
 *   - No row                     → insert succeeds → we own the claim ({ claimed: true })
 *   - Row, processedAt IS NULL   → another worker is processing right now ({ claimed: false, alreadyProcessed: false })
 *   - Row, processedAt NOT NULL  → fully done ({ claimed: false, alreadyProcessed: true })
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
					payload,
				},
			})
			// Insert succeeded — we own the processing slot.
			return { claimed: true, alreadyProcessed: false }
		} catch (error) {
			if (isPrismaUniqueError(error)) {
				// Row already exists — inspect its state.
				try {
					const existing = await prismaClient.stripeWebhookEvent.findUnique({
						where: { eventId },
					})
					const alreadyProcessed = Boolean(existing?.processedAt)
					return { claimed: false, alreadyProcessed }
				} catch (lookupError) {
					console.debug('Prisma idempotency lookup after conflict failed', {
						message: (lookupError as Error).message,
					})
					// Conservative: treat as still-processing so the caller returns 503.
					return { claimed: false, alreadyProcessed: false }
				}
			}
			console.debug('Prisma atomicClaimProcessing failed, falling back to memory.', {
				message: (error as Error).message,
			})
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
	return { claimed: true, alreadyProcessed: false }
}

/**
 * Finalize a previously claimed event: set processedAt to now and prune old rows.
 * Only call this after all effects have succeeded.
 */
export async function finalizeProcessed(eventId: string): Promise<void> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.update({
				where: { eventId },
				data: { processedAt: new Date() },
			})
			const ttlMs = getTtlMs()
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
		} catch (error) {
			console.warn('Prisma finalizeProcessed failed', {
				message: (error as Error).message,
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
 */
export async function releaseProcessingClaim(eventId: string): Promise<void> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.delete({
				where: { eventId },
			})
		} catch (error) {
			console.warn('Prisma releaseProcessingClaim failed', {
				message: (error as Error).message,
			})
		}
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
