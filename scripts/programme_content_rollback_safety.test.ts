import assert from 'node:assert/strict'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Stub env for staging origin guard
process.env.STAGING_TEST_RECIPIENT_EMAIL = 'test@example.invalid'
process.env.STAGING_TEST_MEMBER_EMAIL = 'test@example.invalid'

import {
  executeProgrammeContent,
  loadJournalFromFile,
  type ContentExecutorConfig,
  type JournalEntry,
  type PayloadContentClient,
} from './content/programmeContentExecutor'
import type {
  ProgrammeContentPackage,
  ProgrammeImportPlan,
} from './content/programmeContentContract'

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'rollback-test-'))
}

function minimalPackage(): ProgrammeContentPackage {
  return {
    programme: {
      id: 'test-programme',
      title: 'Test Programme',
      shortSummary: 'A test',
      fullDescription: 'Full description',
      version: '1.0.0',
      locale: 'en',
    },
    weeks: [],
    totalLessons: 0,
    totalResources: 0,
  }
}

function makePlanWithUpdate(): ProgrammeImportPlan {
  return {
    structuralValid: true,
    operations: [
      { id: 'test-programme', kind: 'programme', action: 'update', targetKey: 'payload_courses:test-programme' },
    ],
    dependencies: [],
    warnings: [],
    errors: [],
  }
}

function makePlanWithCreate(): ProgrammeImportPlan {
  return {
    structuralValid: true,
    operations: [
      { id: 'test-programme', kind: 'programme', action: 'create', targetKey: 'payload_courses:test-programme' },
    ],
    dependencies: [],
    warnings: [],
    errors: [],
  }
}

function makeConfig(journalPath: string, mode: 'apply' | 'rollback'): ContentExecutorConfig {
  return {
    mode,
    payloadBaseUrl: 'https://preview.jpvbootcamp.com',
    payloadApiKey: 'test-key',
    confirmationToken: 'tok',
    expectedConfirmationToken: 'tok',
    journalPath,
    batchLimit: 100,
  }
}

// ─── Test: rollback restores updated documents from before-image ─────────────

async function testRollbackRestoresFromBeforeImage() {
  const tmp = makeTmpDir()
  const journalPath = join(tmp, 'journal.ndjson')

  const beforeImage = { title: 'ORIGINAL TITLE', slug: 'test-programme', status: 'published' }
  const journalEntries: JournalEntry[] = [
    {
      runId: 'run-1',
      operationId: 'test-programme',
      kind: 'programme',
      action: 'update',
      collection: 'payload_courses',
      outcome: 'applied',
      payloadDocId: 'doc-123',
      beforeImage,
      timestamp: '2026-07-20T00:00:00.000Z',
    },
  ]
  writeFileSync(journalPath, journalEntries.map((e) => JSON.stringify(e)).join('\n') + '\n')

  let updateCalledWith: { collection: string; id: string; data: Record<string, unknown> } | null = null
  let deleteWasCalled = false

  const client: PayloadContentClient = {
    findBySlug: async () => null,
    findById: async () => null,
    create: async () => ({ id: 'new' }),
    update: async (collection, id, data) => {
      updateCalledWith = { collection, id, data }
      return { id }
    },
    delete: async () => {
      deleteWasCalled = true
    },
  }

  const result = await executeProgrammeContent(
    minimalPackage(),
    makePlanWithUpdate(),
    client,
    makeConfig(journalPath, 'rollback'),
  )

  assert.equal(result.mode, 'rollback')
  assert.equal(result.stoppedEarly, false)
  assert.equal(result.updated, 1)
  assert.equal(deleteWasCalled, false, 'delete must NOT be called for update rollback')
  assert.ok(updateCalledWith, 'update must be called with before-image')
  assert.equal(updateCalledWith!.collection, 'payload_courses')
  assert.equal(updateCalledWith!.id, 'doc-123')
  assert.deepEqual(updateCalledWith!.data, beforeImage)

  rmSync(tmp, { recursive: true })
}

// ─── Test: rollback blocks when before-image is missing for update ────────────

async function testRollbackBlocksWithoutBeforeImage() {
  const tmp = makeTmpDir()
  const journalPath = join(tmp, 'journal.ndjson')

  const journalEntries: JournalEntry[] = [
    {
      runId: 'run-1',
      operationId: 'test-programme',
      kind: 'programme',
      action: 'update',
      collection: 'payload_courses',
      outcome: 'applied',
      payloadDocId: 'doc-123',
      // NO beforeImage
      timestamp: '2026-07-20T00:00:00.000Z',
    },
  ]
  writeFileSync(journalPath, journalEntries.map((e) => JSON.stringify(e)).join('\n') + '\n')

  let anyMutationCalled = false
  const client: PayloadContentClient = {
    findBySlug: async () => null,
    findById: async () => null,
    create: async () => { anyMutationCalled = true; return { id: 'new' } },
    update: async () => { anyMutationCalled = true; return { id: 'x' } },
    delete: async () => { anyMutationCalled = true },
  }

  const result = await executeProgrammeContent(
    minimalPackage(),
    makePlanWithUpdate(),
    client,
    makeConfig(journalPath, 'rollback'),
  )

  assert.equal(result.stoppedEarly, true)
  assert.ok(result.stopReason?.includes('missing before-image'))
  assert.equal(result.failed, 1)
  assert.equal(anyMutationCalled, false, 'no mutations must happen without before-image')

  rmSync(tmp, { recursive: true })
}

// ─── Test: rollback deletes created documents ────────────────────────────────

async function testRollbackDeletesCreatedDocuments() {
  const tmp = makeTmpDir()
  const journalPath = join(tmp, 'journal.ndjson')

  const journalEntries: JournalEntry[] = [
    {
      runId: 'run-1',
      operationId: 'test-programme',
      kind: 'programme',
      action: 'create',
      collection: 'payload_courses',
      outcome: 'applied',
      payloadDocId: 'doc-456',
      timestamp: '2026-07-20T00:00:00.000Z',
    },
  ]
  writeFileSync(journalPath, journalEntries.map((e) => JSON.stringify(e)).join('\n') + '\n')

  let deletedId: string | null = null
  let updateWasCalled = false

  const client: PayloadContentClient = {
    findBySlug: async () => null,
    findById: async () => null,
    create: async () => ({ id: 'new' }),
    update: async () => { updateWasCalled = true; return { id: 'x' } },
    delete: async (_collection, id) => { deletedId = id },
  }

  const result = await executeProgrammeContent(
    minimalPackage(),
    makePlanWithCreate(),
    client,
    makeConfig(journalPath, 'rollback'),
  )

  assert.equal(result.stoppedEarly, false)
  assert.equal(result.created, 1)
  assert.equal(deletedId, 'doc-456')
  assert.equal(updateWasCalled, false, 'update must NOT be called for create rollback')

  rmSync(tmp, { recursive: true })
}

// ─── Test: apply blocks when before-image capture fails ──────────────────────

async function testApplyBlocksOnBeforeImageCaptureFailure() {
  const tmp = makeTmpDir()
  const journalPath = join(tmp, 'journal.ndjson')

  const client: PayloadContentClient = {
    findBySlug: async () => ({ id: 'existing-123' }),
    findById: async () => { throw new Error('network_timeout') },
    create: async () => ({ id: 'new' }),
    update: async () => ({ id: 'x' }),
    delete: async () => {},
  }

  const result = await executeProgrammeContent(
    minimalPackage(),
    makePlanWithUpdate(),
    client,
    makeConfig(journalPath, 'apply'),
  )

  assert.equal(result.stoppedEarly, true)
  assert.ok(result.stopReason?.includes('before-image capture failed'))
  assert.equal(result.failed, 1)

  const journal = loadJournalFromFile(journalPath)
  const failed = journal.filter((e) => e.outcome === 'failed')
  assert.equal(failed.length, 1)
  assert.ok(failed[0].error?.includes('before_image_capture_failed'))

  rmSync(tmp, { recursive: true })
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  await testRollbackRestoresFromBeforeImage()
  console.log('PASS testRollbackRestoresFromBeforeImage')

  await testRollbackBlocksWithoutBeforeImage()
  console.log('PASS testRollbackBlocksWithoutBeforeImage')

  await testRollbackDeletesCreatedDocuments()
  console.log('PASS testRollbackDeletesCreatedDocuments')

  await testApplyBlocksOnBeforeImageCaptureFailure()
  console.log('PASS testApplyBlocksOnBeforeImageCaptureFailure')

  console.log('\nprogramme content rollback safety tests: 4/4 PASSED')
}

main().catch((e) => { console.error(e); process.exit(1) })
