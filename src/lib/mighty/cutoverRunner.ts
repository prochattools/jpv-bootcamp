import type { CutoverAction, CutoverManifestRow } from './cutoverManifest'

export type CutoverCheckpointStatus = 'PENDING' | 'IN_PROGRESS' | 'VERIFIED' | 'REVIEW_REQUIRED' | 'FAILED_RESTORED' | 'COMPLETE'

export type CutoverCheckpoint = {
	email: string
	status: CutoverCheckpointStatus
	memberId: string | null
	lastError: string | null
	updatedAt: string
}

export type CutoverCheckpointStore = {
	get(email: string): CutoverCheckpoint | null
	put(checkpoint: CutoverCheckpoint): void
}

export type CutoverMutationAdapter = {
	createMember(email: string): Promise<{ id: string }>
	grantPlan(memberId: string, planId: string): Promise<void>
	verifyPlan(memberId: string, planId: string): Promise<boolean>
	rollbackPlan(memberId: string, planId: string): Promise<void>
}

export type CutoverRunResult = {
	dryRun: boolean
	processed: CutoverCheckpoint[]
	stoppedOnError: boolean
	mutationPerformed: boolean
}

export function createMemoryCutoverCheckpointStore(): CutoverCheckpointStore {
	const records = new Map<string, CutoverCheckpoint>()
	return {
		get: (email) => records.get(email) ?? null,
		put: (checkpoint) => records.set(checkpoint.email, { ...checkpoint }),
	}
}

function checkpoint(email: string, status: CutoverCheckpointStatus, memberId: string | null, lastError: string | null = null): CutoverCheckpoint {
	return { email, status, memberId, lastError, updatedAt: new Date().toISOString() }
}

function mutableAction(action: CutoverAction): boolean {
	return action === 'MIGRATE_EXISTING' || action === 'CREATE_NEW_AT_CUTOVER'
}

export function planCutoverBatch(rows: CutoverManifestRow[], limit: number): CutoverManifestRow[] {
	if (!Number.isInteger(limit) || limit <= 0) throw new Error('cutover_batch_limit_must_be_positive')
	return rows.filter((row) => mutableAction(row.proposedCutoverAction)).slice(0, limit)
}

export async function runCutoverBatch(params: {
	rows: CutoverManifestRow[]
		batchSize: number
		dryRun: boolean
		store: CutoverCheckpointStore
		adapter?: CutoverMutationAdapter
		planId: string
	}): Promise<CutoverRunResult> {
	const selected = planCutoverBatch(params.rows, params.batchSize)
	if (!params.dryRun && !params.adapter) throw new Error('cutover_mutation_adapter_required')
	const processed: CutoverCheckpoint[] = []
	let mutationPerformed = false

	for (const row of selected) {
		const existing = params.store.get(row.email)
		if (existing?.status === 'COMPLETE' || existing?.status === 'VERIFIED') {
			processed.push(existing)
			continue
		}
		if (row.mightyMatchState === 'PROVIDER_UNCERTAIN' || row.duplicateRisk === 'REVIEW') {
			const review = checkpoint(row.email, 'REVIEW_REQUIRED', row.mightyMemberId, row.reviewReason ?? 'provider uncertainty')
			params.store.put(review)
			processed.push(review)
			continue
		}
		if (params.dryRun) {
			const planned = checkpoint(row.email, 'PENDING', row.mightyMemberId, null)
			params.store.put(planned)
			processed.push(planned)
			continue
		}

		const adapter = params.adapter!
		const started = checkpoint(row.email, 'IN_PROGRESS', row.mightyMemberId, null)
		params.store.put(started)
		let memberId = row.mightyMemberId
		try {
			if (!memberId) {
				memberId = (await adapter.createMember(row.email)).id
				mutationPerformed = true
			}
			await adapter.grantPlan(memberId, params.planId)
			mutationPerformed = true
			if (!await adapter.verifyPlan(memberId, params.planId)) throw new Error('cutover_verification_failed')
			const complete = checkpoint(row.email, 'COMPLETE', memberId, null)
			params.store.put(complete)
			processed.push(complete)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'cutover_provider_error'
			let finalStatus: CutoverCheckpointStatus = 'REVIEW_REQUIRED'
			try {
				if (row.mightyMemberId && memberId) {
					await adapter.rollbackPlan(memberId, params.planId)
					finalStatus = 'FAILED_RESTORED'
				}
			} catch {
				finalStatus = 'REVIEW_REQUIRED'
			}
			const failed = checkpoint(row.email, finalStatus, memberId, message)
			params.store.put(failed)
			processed.push(failed)
			return { dryRun: false, processed, stoppedOnError: true, mutationPerformed }
		}
	}

	return { dryRun: params.dryRun, processed, stoppedOnError: false, mutationPerformed }
}
