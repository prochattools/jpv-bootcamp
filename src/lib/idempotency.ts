import 'server-only'
import prisma from '@/libs/prisma'
import { config } from '@/lib/config'

const ttlMs = config.ops.idempotencyTtlHours * 60 * 60 * 1000
// In-memory fallback is only suitable for development; use DB/Redis in production.
const memoryStore = new Map<string, number>()
const shouldUsePrisma = Boolean(process.env.DATABASE_URL)

type PrismaClientLike = {
	stripeWebhookEvent?: {
		findUnique: (args: { where: { eventId: string } }) => Promise<{ eventId: string } | null>
		create: (args: { data: { eventId: string } }) => Promise<{ eventId: string }>
		deleteMany: (args: { where: { createdAt: { lt: Date } } }) => Promise<{ count: number }>
	}
}

const prismaClient = prisma as unknown as PrismaClientLike

function pruneMemoryStore(now: number) {
	for (const [eventId, timestamp] of memoryStore.entries()) {
		if (now - timestamp > ttlMs) {
			memoryStore.delete(eventId)
		}
	}
}

function isPrismaUniqueError(error: unknown): boolean {
	return Boolean(
		typeof error === 'object' &&
			error &&
			'code' in error &&
			(error as { code?: string }).code === 'P2002'
	)
}

export async function hasProcessed(eventId: string): Promise<boolean> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			const existing = await prismaClient.stripeWebhookEvent.findUnique({
				where: { eventId },
			})
			return Boolean(existing)
		} catch (error) {
			console.warn('Prisma idempotency lookup failed, falling back to memory.', {
				message: (error as Error).message,
			})
		}
	}

	const now = Date.now()
	pruneMemoryStore(now)
	const seenAt = memoryStore.get(eventId)
	return typeof seenAt === 'number' && now - seenAt <= ttlMs
}

export async function markProcessed(eventId: string): Promise<void> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.create({ data: { eventId } })
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { createdAt: { lt: new Date(Date.now() - ttlMs) } },
			})
			return
		} catch (error) {
			if (isPrismaUniqueError(error)) return
			console.warn('Prisma idempotency write failed, falling back to memory.', {
				message: (error as Error).message,
			})
		}
	}

	memoryStore.set(eventId, Date.now())
}
