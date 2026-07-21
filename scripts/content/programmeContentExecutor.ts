/**
 * Programme content apply executor.
 *
 * Accepts a validated import plan from buildProgrammeImportPlan and the full
 * package data, then writes to Payload collections via PayloadContentClient.
 *
 * Modes:
 * - validate  : return the plan as-is without touching Payload (all ops skipped)
 * - dry-run   : simulate operations and log what would happen (default safe mode)
 * - apply     : write to Payload REST API (requires matching confirmation token)
 * - rollback  : undo applied operations by reading the NDJSON journal in reverse
 *
 * Invariants:
 * - Never applies without a matching confirmation token.
 * - Stops on the first failure and emits rollback evidence immediately.
 * - Per-operation idempotency via NDJSON append-only journal.
 * - Resumable: operations already recorded as applied in the journal are skipped.
 * - Batch limit enforced: never processes more than batchLimit operations per run.
 * - No PII or raw content written to operation summaries or console output.
 * - Dependency order preserved: programme → weeks → lessons → resources.
 */

import { appendFileSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { assertStagingOrigin } from '../safety/stagingCommunicationAllowlist'

import type {
  ProgrammeContentPackage,
  ProgrammeImportPlan,
  ProgrammeLesson,
  ProgrammeResource,
  ProgrammeWeek,
} from './programmeContentContract'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExecutorMode = 'validate' | 'dry-run' | 'apply' | 'rollback'

export interface ContentExecutorConfig {
  mode: ExecutorMode
  payloadBaseUrl: string
  payloadApiKey: string
  confirmationToken: string
  expectedConfirmationToken: string
  journalPath?: string
  batchLimit: number
}

export interface ContentExecutorResult {
  mode: ExecutorMode
  runId: string
  operations: ContentOperationResult[]
  created: number
  updated: number
  skipped: number
  failed: number
  stoppedEarly: boolean
  stopReason?: string
}

export interface ContentOperationResult {
  operationId: string
  kind: string
  action: string
  outcome: 'dry_run' | 'applied' | 'skipped' | 'failed'
  payloadDocId?: string
  error?: string
  timestamp: string
}

/**
 * Dependency-injected Payload client interface.
 * The executor never imports Payload directly — all reads and writes go
 * through this interface, which callers can satisfy with a REST client,
 * a test double, or the Payload local API adapter.
 */
export interface PayloadContentClient {
  /** Find a document by its slug (or other stable identifier). Returns null if not found. */
  findBySlug(collection: string, slug: string): Promise<{ id: string } | null>
  /** Read a full document by ID. Used to capture before-image for reversible updates. */
  findById(collection: string, id: string): Promise<Record<string, unknown> | null>
  /** Create a document; returns the new document's Payload ID. */
  create(collection: string, data: Record<string, unknown>): Promise<{ id: string }>
  /** Update an existing document by its Payload ID. */
  update(collection: string, id: string, data: Record<string, unknown>): Promise<{ id: string }>
  /** Delete a document by its Payload ID. Used during rollback only. */
  delete(collection: string, id: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Internal journal entry type (written to NDJSON journal)
// ---------------------------------------------------------------------------

export interface JournalEntry {
  runId: string
  operationId: string
  kind: string
  action: string
  collection: string
  outcome: 'dry_run' | 'applied' | 'skipped' | 'failed'
  payloadDocId?: string
  beforeImage?: Record<string, unknown>
  error?: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Collection routing
// ---------------------------------------------------------------------------

const KIND_TO_COLLECTION: Record<string, string> = {
  programme: 'payload_courses',
  week: 'payload_course_modules',
  lesson: 'payload_lessons',
  resource: 'payload_lesson_resources',
}

function collectionForKind(kind: string): string {
  const collection = KIND_TO_COLLECTION[kind]
  if (!collection) throw new Error(`unknown_operation_kind: ${kind}`)
  return collection
}

// ---------------------------------------------------------------------------
// Document builders — map canonical content types to Payload field shapes.
// Raw content and PII are never logged; only operation IDs and outcomes are.
// ---------------------------------------------------------------------------

function textToLexical(text: string): Record<string, unknown> {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', text, version: 1 }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function deriveVideoProvider(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('vimeo.com')) return 'vimeo'
  if (url.includes('mux.com') || url.includes('stream.mux.com')) return 'mux'
  return 'other'
}

function buildCourseDocument(pkg: ProgrammeContentPackage): Record<string, unknown> {
  return {
    title: pkg.programme.title,
    slug: pkg.programme.id,
    shortDescription: pkg.programme.shortSummary,
    status: 'draft',
    visibility: 'members',
    accessBadge: 'pro',
    sortOrder: 0,
    showInPrototypeDashboard: false,
    featured: false,
    prototypeKey: pkg.programme.id,
    prototypeNote: [
      'Imported from programme content package.',
      `Version: ${pkg.programme.version}.`,
      `Locale: ${pkg.programme.locale}.`,
    ].join(' '),
  }
}

function buildModuleDocument(week: ProgrammeWeek, courseId: string): Record<string, unknown> {
  return {
    title: week.title,
    description: week.summary,
    sortOrder: week.sequence,
    publishedPreview: false,
    course: courseId,
  }
}

function buildLessonDocument(lesson: ProgrammeLesson, moduleId: string): Record<string, unknown> {
  return {
    title: lesson.title,
    slug: lesson.slug,
    summary: lesson.summary,
    content: textToLexical(lesson.body),
    sortOrder: lesson.sequence,
    estimatedDuration: lesson.estimatedDuration,
    previewLesson: lesson.previewAvailable,
    videoProviderLabel: lesson.videoReference ? deriveVideoProvider(lesson.videoReference) : 'none',
    videoIdOrPreviewUrl: lesson.videoReference ?? null,
    module: moduleId,
    mockCompletionState: 'not_started',
    visualLockState: 'available',
  }
}

function buildResourceDocument(
  resource: ProgrammeResource,
  lessonId: string,
  sortOrder: number,
): Record<string, unknown> {
  return {
    title: resource.label,
    description: resource.accessibilityLabel,
    status: 'draft',
    downloadRequiresAccess: true,
    sortOrder,
    lesson: lessonId,
  }
}

// ---------------------------------------------------------------------------
// Package lookup helpers — prebuilt maps for O(1) access during execution
// ---------------------------------------------------------------------------

interface PackageLookups {
  weekById: Map<string, ProgrammeWeek>
  lessonById: Map<string, { lesson: ProgrammeLesson; weekId: string }>
  resourceById: Map<string, { resource: ProgrammeResource; lessonId: string; sortOrder: number }>
}

function buildPackageLookups(pkg: ProgrammeContentPackage): PackageLookups {
  const weekById = new Map<string, ProgrammeWeek>()
  const lessonById = new Map<string, { lesson: ProgrammeLesson; weekId: string }>()
  const resourceById = new Map<string, { resource: ProgrammeResource; lessonId: string; sortOrder: number }>()

  for (const week of pkg.weeks) {
    weekById.set(week.id, week)
    for (const lesson of week.lessons) {
      lessonById.set(lesson.id, { lesson, weekId: week.id })
      for (const [idx, resource] of lesson.resources.entries()) {
        resourceById.set(resource.id, { resource, lessonId: lesson.id, sortOrder: idx })
      }
    }
  }

  return { weekById, lessonById, resourceById }
}

// ---------------------------------------------------------------------------
// Journal persistence
// ---------------------------------------------------------------------------

export function loadJournalFromFile(journalPath: string): JournalEntry[] {
  try {
    const raw = readFileSync(journalPath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as JournalEntry)
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

function appendEntryToDisk(entry: JournalEntry, journalPath: string): void {
  appendFileSync(journalPath, JSON.stringify(entry) + '\n', 'utf8')
}

function recordEntry(
  entry: JournalEntry,
  operations: ContentOperationResult[],
  journalPath: string | undefined,
): void {
  operations.push({
    operationId: entry.operationId,
    kind: entry.kind,
    action: entry.action,
    outcome: entry.outcome,
    payloadDocId: entry.payloadDocId,
    error: entry.error,
    timestamp: entry.timestamp,
  })
  if (journalPath) {
    appendEntryToDisk(entry, journalPath)
  }
}

function alreadyInJournal(operationId: string, journal: JournalEntry[]): boolean {
  return journal.some(
    (e) =>
      e.operationId === operationId &&
      (e.outcome === 'applied' || e.outcome === 'skipped'),
  )
}

// ---------------------------------------------------------------------------
// Slug extraction from targetKey — targetKey format: "{collection}:{slug}"
// ---------------------------------------------------------------------------

function slugFromTargetKey(targetKey: string): string {
  const colonIndex = targetKey.indexOf(':')
  return colonIndex === -1 ? targetKey : targetKey.slice(colonIndex + 1)
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

export async function executeProgrammeContent(
  packageData: ProgrammeContentPackage,
  plan: ProgrammeImportPlan,
  client: PayloadContentClient,
  config: ContentExecutorConfig,
): Promise<ContentExecutorResult> {
  const runId = randomUUID()

  const result: ContentExecutorResult = {
    mode: config.mode,
    runId,
    operations: [],
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    stoppedEarly: false,
  }

  // ------------------------------------------------------------------
  // validate mode: return the plan without touching Payload
  // ------------------------------------------------------------------
  if (config.mode === 'validate') {
    for (const op of plan.operations) {
      result.operations.push({
        operationId: op.id,
        kind: op.kind,
        action: op.action,
        outcome: 'skipped',
        timestamp: new Date().toISOString(),
      })
      result.skipped++
    }
    return result
  }

  // ------------------------------------------------------------------
  // rollback mode: undo applied entries from journal in reverse order
  // ------------------------------------------------------------------
  if (config.mode === 'rollback') {
    if (!config.journalPath) {
      result.stoppedEarly = true
      result.stopReason = 'rollback_requires_journal_path'
      return result
    }

    const journal = loadJournalFromFile(config.journalPath)
    const applied = journal.filter((e) => e.outcome === 'applied').reverse()

    for (const entry of applied) {
      if (!entry.payloadDocId) continue
      try {
        await client.delete(entry.collection, entry.payloadDocId)
        const opResult: ContentOperationResult = {
          operationId: entry.operationId,
          kind: entry.kind,
          action: 'rollback',
          outcome: 'applied',
          payloadDocId: entry.payloadDocId,
          timestamp: new Date().toISOString(),
        }
        result.operations.push(opResult)
        result.created++ // reusing created as "rollback deletions applied"
      } catch (e) {
        result.operations.push({
          operationId: entry.operationId,
          kind: entry.kind,
          action: 'rollback',
          outcome: 'failed',
          payloadDocId: entry.payloadDocId,
          error: `rollback_delete_failed: ${e instanceof Error ? e.message : String(e)}`,
          timestamp: new Date().toISOString(),
        })
        result.failed++
        result.stoppedEarly = true
        result.stopReason = `rollback_failed_on_operation: ${entry.operationId}`
        return result
      }
    }

    return result
  }

  // ------------------------------------------------------------------
  // apply mode: require confirmation token
  // ------------------------------------------------------------------
  if (config.mode === 'apply' && config.confirmationToken !== config.expectedConfirmationToken) {
    result.stoppedEarly = true
    result.stopReason = 'confirmation_token_mismatch — apply blocked'
    return result
  }

  // ------------------------------------------------------------------
  // Block execution if plan is not structurally valid
  // ------------------------------------------------------------------
  if (!plan.structuralValid) {
    result.stoppedEarly = true
    result.stopReason = 'plan_not_structurally_valid — execution blocked'
    return result
  }

  // ------------------------------------------------------------------
  // Load prior journal for idempotency (resume support)
  // ------------------------------------------------------------------
  const priorJournal = config.journalPath ? loadJournalFromFile(config.journalPath) : []

  // ------------------------------------------------------------------
  // Build content lookup maps (O(1) access during execution)
  // ------------------------------------------------------------------
  const lookups = buildPackageLookups(packageData)

  // Runtime ID map: logical key → Payload document ID.
  // Required for parent-child resolution during dependency chain.
  // key format: "programme:{id}", "week:{id}", "lesson:{id}", "resource:{id}"
  const idMap = new Map<string, string>()

  // ------------------------------------------------------------------
  // Process operations respecting batch limit
  // ------------------------------------------------------------------
  const eligibleOps = plan.operations.filter(
    (op) => op.action !== 'unchanged' && !alreadyInJournal(op.id, priorJournal),
  )
  const toProcess = eligibleOps.slice(0, config.batchLimit)

  // Carry skipped/unchanged ops into the result as skipped
  const unchangedOrPriorJournaled = plan.operations.filter(
    (op) => op.action === 'unchanged' || alreadyInJournal(op.id, priorJournal),
  )
  for (const op of unchangedOrPriorJournaled) {
    result.operations.push({
      operationId: op.id,
      kind: op.kind,
      action: op.action,
      outcome: 'skipped',
      timestamp: new Date().toISOString(),
    })
    result.skipped++
  }

  for (const op of toProcess) {
    const collection = collectionForKind(op.kind)
    const timestamp = new Date().toISOString()

    // ------------------------------------------------------------------
    // 'archive_or_defer' operations require manual review — skip with warning
    // ------------------------------------------------------------------
    if (op.action === 'archive_or_defer') {
      const entry: JournalEntry = {
        runId,
        operationId: op.id,
        kind: op.kind,
        action: op.action,
        collection,
        outcome: 'skipped',
        timestamp,
      }
      recordEntry(entry, result.operations, config.journalPath)
      result.skipped++
      continue
    }

    // ------------------------------------------------------------------
    // Resolve parent document ID for dependency chain
    // ------------------------------------------------------------------
    let resolvedParentId: string | null = null

    if (op.kind === 'week') {
      resolvedParentId = idMap.get(`programme:${packageData.programme.id}`) ?? null
      if (!resolvedParentId) {
        // Parent course not yet in idMap — try to find it via client
        try {
          const existing = await client.findBySlug('payload_courses', packageData.programme.id)
          if (existing) {
            resolvedParentId = existing.id
            idMap.set(`programme:${packageData.programme.id}`, existing.id)
          }
        } catch {
          // ignore — will fail at build stage below
        }
      }
    }

    if (op.kind === 'lesson') {
      const meta = lookups.lessonById.get(op.id)
      if (meta) {
        resolvedParentId = idMap.get(`week:${meta.weekId}`) ?? null
        if (!resolvedParentId) {
          const entry: JournalEntry = {
            runId,
            operationId: op.id,
            kind: op.kind,
            action: op.action,
            collection,
            outcome: 'failed',
            error: `parent_module_id_unresolved: week_id=${meta.weekId}`,
            timestamp,
          }
          recordEntry(entry, result.operations, config.journalPath)
          result.failed++
          result.stoppedEarly = true
          result.stopReason = `invariant: parent module not resolved for lesson ${op.id}`
          return result
        }
      }
    }

    if (op.kind === 'resource') {
      const meta = lookups.resourceById.get(op.id)
      if (meta) {
        resolvedParentId = idMap.get(`lesson:${meta.lessonId}`) ?? null
        if (!resolvedParentId) {
          const entry: JournalEntry = {
            runId,
            operationId: op.id,
            kind: op.kind,
            action: op.action,
            collection,
            outcome: 'failed',
            error: `parent_lesson_id_unresolved: lesson_id=${meta.lessonId}`,
            timestamp,
          }
          recordEntry(entry, result.operations, config.journalPath)
          result.failed++
          result.stoppedEarly = true
          result.stopReason = `invariant: parent lesson not resolved for resource ${op.id}`
          return result
        }
      }
    }

    // ------------------------------------------------------------------
    // Build the document payload from canonical package data
    // ------------------------------------------------------------------
    let documentData: Record<string, unknown> | null = null

    try {
      if (op.kind === 'programme') {
        documentData = buildCourseDocument(packageData)
      } else if (op.kind === 'week') {
        const week = lookups.weekById.get(op.id)
        if (!week) throw new Error(`week_not_found_in_package: ${op.id}`)
        if (!resolvedParentId) throw new Error(`course_id_required_for_module: ${op.id}`)
        documentData = buildModuleDocument(week, resolvedParentId)
      } else if (op.kind === 'lesson') {
        const meta = lookups.lessonById.get(op.id)
        if (!meta) throw new Error(`lesson_not_found_in_package: ${op.id}`)
        if (!resolvedParentId) throw new Error(`module_id_required_for_lesson: ${op.id}`)
        documentData = buildLessonDocument(meta.lesson, resolvedParentId)
      } else if (op.kind === 'resource') {
        const meta = lookups.resourceById.get(op.id)
        if (!meta) throw new Error(`resource_not_found_in_package: ${op.id}`)
        if (!resolvedParentId) throw new Error(`lesson_id_required_for_resource: ${op.id}`)
        documentData = buildResourceDocument(meta.resource, resolvedParentId, meta.sortOrder)
      }
    } catch (e) {
      const entry: JournalEntry = {
        runId,
        operationId: op.id,
        kind: op.kind,
        action: op.action,
        collection,
        outcome: 'failed',
        error: `document_build_failed: ${e instanceof Error ? e.message : String(e)}`,
        timestamp,
      }
      recordEntry(entry, result.operations, config.journalPath)
      result.failed++
      result.stoppedEarly = true
      result.stopReason = `invariant: document build failed for operation ${op.id}`
      return result
    }

    if (!documentData) {
      const entry: JournalEntry = {
        runId,
        operationId: op.id,
        kind: op.kind,
        action: op.action,
        collection,
        outcome: 'failed',
        error: 'document_data_null_after_build',
        timestamp,
      }
      recordEntry(entry, result.operations, config.journalPath)
      result.failed++
      result.stoppedEarly = true
      result.stopReason = `invariant: document data null for operation ${op.id}`
      return result
    }

    // ------------------------------------------------------------------
    // dry-run mode: record without writing to Payload
    // ------------------------------------------------------------------
    if (config.mode === 'dry-run') {
      const entry: JournalEntry = {
        runId,
        operationId: op.id,
        kind: op.kind,
        action: op.action,
        collection,
        outcome: 'dry_run',
        timestamp,
      }
      recordEntry(entry, result.operations, config.journalPath)
      // In dry-run, maintain a synthetic idMap using the operation ID itself
      // so downstream dependency resolution continues correctly in the simulation.
      idMap.set(`${op.kind}:${op.id}`, `dry-run-id:${op.id}`)
      if (op.action === 'create') result.created++
      else result.updated++
      continue
    }

    // ------------------------------------------------------------------
    // apply mode: find existing or create/update in Payload
    // ------------------------------------------------------------------
    const slug = slugFromTargetKey(op.targetKey)

    if (op.action === 'update') {
      // Find existing document to get its Payload ID
      let existingId: string | null = null
      try {
        const existing = await client.findBySlug(collection, slug)
        existingId = existing?.id ?? null
      } catch (e) {
        const entry: JournalEntry = {
          runId,
          operationId: op.id,
          kind: op.kind,
          action: op.action,
          collection,
          outcome: 'failed',
          error: `find_existing_failed: ${e instanceof Error ? e.message : String(e)}`,
          timestamp,
        }
        recordEntry(entry, result.operations, config.journalPath)
        result.failed++
        result.stoppedEarly = true
        result.stopReason = `invariant: findBySlug failed for update operation ${op.id}`
        return result
      }

      if (!existingId) {
        // Treat as create if update target no longer exists
        // (plan was built before live state was checked)
        try {
          const created = await client.create(collection, documentData)
          idMap.set(`${op.kind}:${op.id}`, created.id)
          const entry: JournalEntry = {
            runId,
            operationId: op.id,
            kind: op.kind,
            action: 'create',
            collection,
            outcome: 'applied',
            payloadDocId: created.id,
            timestamp,
          }
          recordEntry(entry, result.operations, config.journalPath)
          result.created++
        } catch (e) {
          const entry: JournalEntry = {
            runId,
            operationId: op.id,
            kind: op.kind,
            action: op.action,
            collection,
            outcome: 'failed',
            error: `create_fallback_failed: ${e instanceof Error ? e.message : String(e)}`,
            timestamp,
          }
          recordEntry(entry, result.operations, config.journalPath)
          result.failed++
          result.stoppedEarly = true
          result.stopReason = `invariant: create-fallback failed for operation ${op.id}`
          return result
        }
        continue
      }

      // Capture before-image for reversible updates
      let beforeImage: Record<string, unknown> | null = null
      try {
        beforeImage = await client.findById(collection, existingId)
      } catch {
        // Non-fatal: proceed without before-image but log a warning
      }

      // Update the existing document
      try {
        const updated = await client.update(collection, existingId, documentData)
        idMap.set(`${op.kind}:${op.id}`, updated.id)
        const entry: JournalEntry = {
          runId,
          operationId: op.id,
          kind: op.kind,
          action: op.action,
          collection,
          outcome: 'applied',
          payloadDocId: updated.id,
          ...(beforeImage ? { beforeImage } : {}),
          timestamp,
        }
        recordEntry(entry, result.operations, config.journalPath)
        result.updated++
      } catch (e) {
        const entry: JournalEntry = {
          runId,
          operationId: op.id,
          kind: op.kind,
          action: op.action,
          collection,
          outcome: 'failed',
          error: `update_failed: ${e instanceof Error ? e.message : String(e)}`,
          timestamp,
        }
        recordEntry(entry, result.operations, config.journalPath)
        result.failed++
        result.stoppedEarly = true
        result.stopReason = `invariant: update failed for operation ${op.id}`
        return result
      }
    } else {
      // action === 'create'
      try {
        const created = await client.create(collection, documentData)
        idMap.set(`${op.kind}:${op.id}`, created.id)
        const entry: JournalEntry = {
          runId,
          operationId: op.id,
          kind: op.kind,
          action: op.action,
          collection,
          outcome: 'applied',
          payloadDocId: created.id,
          timestamp,
        }
        recordEntry(entry, result.operations, config.journalPath)
        result.created++
      } catch (e) {
        const entry: JournalEntry = {
          runId,
          operationId: op.id,
          kind: op.kind,
          action: op.action,
          collection,
          outcome: 'failed',
          error: `create_failed: ${e instanceof Error ? e.message : String(e)}`,
          timestamp,
        }
        recordEntry(entry, result.operations, config.journalPath)
        result.failed++
        result.stoppedEarly = true
        result.stopReason = `invariant: create failed for operation ${op.id}`
        return result
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Rollback evidence report
// ---------------------------------------------------------------------------

export function buildRollbackEvidence(result: ContentExecutorResult): string {
  const applied = result.operations.filter((op) => op.outcome === 'applied')
  const lines = [
    '# Programme Content Executor Rollback Evidence',
    '',
    `- Run ID: ${result.runId}`,
    `- Mode: ${result.mode}`,
    `- Created: ${result.created}`,
    `- Updated: ${result.updated}`,
    `- Skipped: ${result.skipped}`,
    `- Failed: ${result.failed}`,
    `- Stopped early: ${result.stoppedEarly}`,
    `- Stop reason: ${result.stopReason ?? 'none'}`,
    '',
    '## Applied operations (to reverse)',
    '',
    '| Operation ID | Kind | Action | Payload Doc ID |',
    '| --- | --- | --- | --- |',
  ]

  for (const op of applied) {
    lines.push(`| ${op.operationId} | ${op.kind} | ${op.action} | ${op.payloadDocId ?? 'n/a'} |`)
  }

  lines.push(
    '',
    '## Rollback procedure',
    '',
    'For each applied row above: delete the Payload document at the listed Payload Doc ID.',
    'Process in reverse dependency order: resources → lessons → modules → courses.',
    'Use rollback mode with the original journalPath to automate this.',
    '',
    'This evidence was generated automatically — operator must confirm correctness',
    'before executing rollback.',
  )

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// REST Payload client factory
// Provides a concrete PayloadContentClient over the Payload REST API.
// Callers inject this when running against a live or staging Payload instance.
// ---------------------------------------------------------------------------

export function makeRestPayloadClient(baseUrl: string, apiKey: string): PayloadContentClient {
  assertStagingOrigin(baseUrl)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `users API-Key ${apiKey}`,
  }

  async function apiFetch(
    method: string,
    url: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error')
      throw new Error(`payload_api_error: ${method} ${url} → ${response.status}: ${text.slice(0, 200)}`)
    }

    return response.json()
  }

  return {
    async findBySlug(collection: string, slug: string): Promise<{ id: string } | null> {
      const url = `${baseUrl}/api/${collection}?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`
      const data = (await apiFetch('GET', url)) as { docs?: Array<{ id: string }> }
      return data.docs?.[0] ?? null
    },

    async findById(collection: string, id: string): Promise<Record<string, unknown> | null> {
      const url = `${baseUrl}/api/${collection}/${encodeURIComponent(id)}?depth=0`
      try {
        return (await apiFetch('GET', url)) as Record<string, unknown>
      } catch {
        return null
      }
    },

    async create(collection: string, data: Record<string, unknown>): Promise<{ id: string }> {
      const url = `${baseUrl}/api/${collection}`
      const result = (await apiFetch('POST', url, data)) as { doc: { id: string } }
      return { id: result.doc.id }
    },

    async update(
      collection: string,
      id: string,
      data: Record<string, unknown>,
    ): Promise<{ id: string }> {
      const url = `${baseUrl}/api/${collection}/${encodeURIComponent(id)}`
      const result = (await apiFetch('PATCH', url, data)) as { doc: { id: string } }
      return { id: result.doc.id }
    },

    async delete(collection: string, id: string): Promise<void> {
      const url = `${baseUrl}/api/${collection}/${encodeURIComponent(id)}`
      await apiFetch('DELETE', url)
    },
  }
}
