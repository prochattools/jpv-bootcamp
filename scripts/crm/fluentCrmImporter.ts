/**
 * FluentCRM export importer.
 *
 * Converts FluentCRM CSV or JSON exports into Payload CRM collections
 * (payload_contacts, payload_crm_tags, payload_contact_tags).
 *
 * Modes:
 *   validate  — parse and validate the input file only; no client calls
 *   dry-run   — run full logic with a real client but never mutate
 *   apply     — mutate with confirmation token guard; NDJSON journal; resumable
 *   rollback  — emit rollback evidence from a prior journal; no mutations
 *
 * Safety invariants:
 *   - Never overwrites unsubscribed / bounced / complained with subscribed.
 *   - Dry-run never calls create/update methods on the client.
 *   - Apply is blocked without a matching confirmation token.
 *   - Stop-on-first-critical-failure.
 *   - SHA-256 idempotency key per normalised email.
 *   - NDJSON journal supports resume across partial runs.
 *   - Batch limit enforced; never processes more than batchLimit in one run.
 */

import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ImportMode = 'validate' | 'dry-run' | 'apply' | 'rollback'
export type InputFormat = 'csv' | 'json'

export interface FluentCrmImportConfig {
  inputPath: string
  format: InputFormat
  mode: ImportMode
  confirmationToken: string
  expectedConfirmationToken: string
  batchLimit: number
  journalPath?: string
  payloadBaseUrl: string
  payloadApiKey: string
}

export interface FluentCrmContact {
  email: string
  firstName: string
  lastName: string
  status: string
  tags: string[]
  lists: string[]
  createdAt: string
  lastActivity: string
  company: string
  source: string
  consentAt: string | null
}

export interface ImportJournalEntry {
  runId: string
  email: string
  idempotencyKey: string
  outcome: 'created' | 'updated' | 'skipped' | 'failed'
  payloadContactId?: string
  error?: string
  timestamp: string
}

export interface ImportResult {
  runId: string
  mode: ImportMode
  contacts: { created: number; updated: number; skipped: number; failed: number }
  tags: { created: number; skipped: number }
  contactTags: { created: number; skipped: number }
  stoppedEarly: boolean
  stopReason?: string
  warnings: string[]
  journal: ImportJournalEntry[]
}

// ─── Payload client interface (dependency injection) ─────────────────────────

export interface PayloadCrmClient {
  findContactByEmail(email: string): Promise<{ id: string; emailStatus: string } | null>
  createContact(data: Record<string, unknown>): Promise<{ id: string }>
  updateContact(id: string, data: Record<string, unknown>): Promise<{ id: string }>
  findTagBySlug(slug: string): Promise<{ id: string } | null>
  createTag(data: Record<string, unknown>): Promise<{ id: string }>
  findContactTag(contactId: string, tagId: string): Promise<{ id: string } | null>
  createContactTag(data: Record<string, unknown>): Promise<{ id: string }>
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface ParsedInput {
  contacts: FluentCrmContact[]
  warnings: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Email statuses that must never be overwritten by an import — consent
 * suppressions are sticky.
 */
const PROTECTED_EMAIL_STATUSES: ReadonlySet<string> = new Set([
  'unsubscribed',
  'bounced',
  'complained',
])

/** FluentCRM status → Payload emailStatus mapping */
const STATUS_MAP: Record<string, string> = {
  subscribed: 'subscribed',
  unsubscribed: 'unsubscribed',
  bounced: 'bounced',
  complained: 'complained',
  pending: 'transactional_only',
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180-compatible CSV parser.
 * Handles quoted fields, escaped quotes, and CRLF/LF line endings.
 * No external dependencies.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let value = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          value += '"'
          i += 2
        } else if (line[i] === '"') {
          i++ // skip closing quote
          break
        } else {
          value += line[i]
          i++
        }
      }
      // skip comma after closing quote
      if (i < line.length && line[i] === ',') i++
      fields.push(value)
    } else {
      // Unquoted field
      const commaIndex = line.indexOf(',', i)
      if (commaIndex === -1) {
        fields.push(line.slice(i))
        break
      }
      fields.push(line.slice(i, commaIndex))
      i = commaIndex + 1
    }
  }
  return fields
}

function parseCsv(raw: string): Array<Record<string, string>> {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.filter((line) => line.trim().length > 0)
  if (nonEmpty.length < 2) return []

  const headers = parseCsvLine(nonEmpty[0]).map((h) => h.trim())
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCsvLine(nonEmpty[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }

  return rows
}

// ─── Input parsing ────────────────────────────────────────────────────────────

function rowToContact(row: Record<string, string>): FluentCrmContact {
  const tagsRaw = (row['tags'] ?? '').trim()
  const listsRaw = (row['lists'] ?? '').trim()

  const tags = tagsRaw
    ? tagsRaw
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  const lists = listsRaw
    ? listsRaw
        .split('|')
        .map((l) => l.trim())
        .filter(Boolean)
    : []

  const consentRaw = (row['consent_at'] ?? '').trim()

  return {
    email: (row['email'] ?? '').trim(),
    firstName: (row['first_name'] ?? '').trim(),
    lastName: (row['last_name'] ?? '').trim(),
    status: (row['status'] ?? '').trim(),
    tags,
    lists,
    createdAt: (row['created_at'] ?? '').trim(),
    lastActivity: (row['last_activity'] ?? '').trim(),
    company: (row['company'] ?? '').trim(),
    source: (row['source'] ?? '').trim(),
    consentAt: consentRaw || null,
  }
}

export function parseCsvInput(raw: string): ParsedInput {
  const rows = parseCsv(raw)
  const warnings: string[] = []
  const contacts: FluentCrmContact[] = []

  for (const row of rows) {
    const contact = rowToContact(row)
    if (!contact.email) {
      warnings.push(`csv row missing email — skipped: ${JSON.stringify(row)}`)
      continue
    }
    contacts.push(contact)
  }

  return { contacts, warnings }
}

export function parseJsonInput(raw: string): ParsedInput {
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`FluentCRM JSON input is not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('FluentCRM JSON input must be an array of contact objects')
  }

  const contacts: FluentCrmContact[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      warnings.push(`json item[${i}] is not an object — skipped`)
      continue
    }
    const row = item as Record<string, unknown>
    const email = typeof row['email'] === 'string' ? row['email'].trim() : ''
    if (!email) {
      warnings.push(`json item[${i}] missing email — skipped`)
      continue
    }

    const tagsRaw = typeof row['tags'] === 'string' ? row['tags'] : ''
    const listsRaw = typeof row['lists'] === 'string' ? row['lists'] : ''
    const consentRaw = typeof row['consent_at'] === 'string' ? row['consent_at'].trim() : ''

    contacts.push({
      email,
      firstName: typeof row['first_name'] === 'string' ? row['first_name'].trim() : '',
      lastName: typeof row['last_name'] === 'string' ? row['last_name'].trim() : '',
      status: typeof row['status'] === 'string' ? row['status'].trim() : '',
      tags: tagsRaw
        ? tagsRaw
            .split('|')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [],
      lists: listsRaw
        ? listsRaw
            .split('|')
            .map((l: string) => l.trim())
            .filter(Boolean)
        : [],
      createdAt: typeof row['created_at'] === 'string' ? row['created_at'].trim() : '',
      lastActivity: typeof row['last_activity'] === 'string' ? row['last_activity'].trim() : '',
      company: typeof row['company'] === 'string' ? row['company'].trim() : '',
      source: typeof row['source'] === 'string' ? row['source'].trim() : '',
      consentAt: consentRaw || null,
    })
  }

  return { contacts, warnings }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function normaliseEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Deduplicates contacts by normalised email address.
 * When duplicates are found, the record with the most recent lastActivity is
 * kept. Warnings are appended for each duplicate discarded.
 */
export function deduplicateContacts(
  contacts: FluentCrmContact[],
  warnings: string[],
): FluentCrmContact[] {
  const seen = new Map<string, FluentCrmContact>()

  for (const contact of contacts) {
    const key = normaliseEmail(contact.email)
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, contact)
      continue
    }
    // Keep the one with the most recent lastActivity
    const existingTs = existing.lastActivity ? Date.parse(existing.lastActivity) : 0
    const incomingTs = contact.lastActivity ? Date.parse(contact.lastActivity) : 0
    if (incomingTs > existingTs) {
      warnings.push(
        `duplicate email ${key}: discarded older record (lastActivity: ${existing.lastActivity || 'none'}) in favour of newer (lastActivity: ${contact.lastActivity || 'none'})`,
      )
      seen.set(key, contact)
    } else {
      warnings.push(
        `duplicate email ${key}: discarded incoming record (lastActivity: ${contact.lastActivity || 'none'}) — existing is newer or equal`,
      )
    }
  }

  return [...seen.values()]
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export function mapEmailStatus(fluentStatus: string): string {
  return STATUS_MAP[fluentStatus] ?? 'transactional_only'
}

export function mapSource(source: string): string {
  if (!source) return 'fluentcrm:import'
  if (source.startsWith('fluentcrm:')) return source
  return `fluentcrm:${source}`
}

export function buildTagSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

export function buildIdempotencyKey(email: string): string {
  return createHash('sha256').update(normaliseEmail(email)).digest('hex')
}

// ─── Journal helpers ──────────────────────────────────────────────────────────

export function loadJournalFromFile(journalPath: string): ImportJournalEntry[] {
  try {
    const raw = readFileSync(journalPath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ImportJournalEntry)
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

function appendEntryToDisk(entry: ImportJournalEntry, journalPath: string): void {
  appendFileSync(journalPath, JSON.stringify(entry) + '\n', 'utf8')
}

function recordJournalEntry(
  entry: ImportJournalEntry,
  result: ImportResult,
  journalPath: string | undefined,
): void {
  result.journal.push(entry)
  if (journalPath) {
    appendEntryToDisk(entry, journalPath)
  }
}

function isAlreadyJournaled(email: string, journal: ImportJournalEntry[]): boolean {
  const key = normaliseEmail(email)
  return journal.some(
    (e) =>
      normaliseEmail(e.email) === key &&
      (e.outcome === 'created' || e.outcome === 'updated' || e.outcome === 'skipped'),
  )
}

// ─── Consent guard ────────────────────────────────────────────────────────────

/**
 * Returns the safe email status to write.
 * Never downgrades an existing protected status (unsubscribed/bounced/complained)
 * to subscribed.
 */
export function resolveEmailStatus(
  incomingStatus: string,
  existingStatus: string | undefined,
): { status: string; consentConflict: boolean } {
  if (existingStatus && PROTECTED_EMAIL_STATUSES.has(existingStatus)) {
    if (incomingStatus === 'subscribed') {
      return { status: existingStatus, consentConflict: true }
    }
  }
  return { status: incomingStatus, consentConflict: false }
}

// ─── Tag resolution ───────────────────────────────────────────────────────────

interface TagResolutionState {
  tagIdCache: Map<string, string>
  tagsCreated: number
  tagsSkipped: number
}

async function resolveOrCreateTag(
  name: string,
  sourceOverride: string | null,
  mode: ImportMode,
  client: PayloadCrmClient,
  state: TagResolutionState,
  warnings: string[],
): Promise<string | null> {
  const slug = buildTagSlug(name)
  if (!slug) {
    warnings.push(`tag name "${name}" produced an empty slug — skipped`)
    return null
  }

  // Cache hit
  const cached = state.tagIdCache.get(slug)
  if (cached !== undefined) {
    state.tagsSkipped++
    return cached
  }

  // Lookup
  const existing = await client.findTagBySlug(slug)
  if (existing) {
    state.tagIdCache.set(slug, existing.id)
    state.tagsSkipped++
    return existing.id
  }

  // Create
  if (mode !== 'apply') {
    // In dry-run / validate, generate a synthetic placeholder ID so downstream
    // logic can continue without mutations.
    const placeholderId = `dry-run-tag-${slug}`
    state.tagIdCache.set(slug, placeholderId)
    state.tagsCreated++
    return placeholderId
  }

  const created = await client.createTag({
    name,
    slug,
    status: 'active',
    ...(sourceOverride ? { description: `imported from ${sourceOverride}` } : {}),
  })
  state.tagIdCache.set(slug, created.id)
  state.tagsCreated++
  return created.id
}

// ─── Core import engine ───────────────────────────────────────────────────────

export interface RunImportOptions {
  runId: string
  contacts: FluentCrmContact[]
  config: FluentCrmImportConfig
  client: PayloadCrmClient
  initialJournal: ImportJournalEntry[]
  initialWarnings: string[]
}

export async function runImport(options: RunImportOptions): Promise<ImportResult> {
  const { runId, contacts, config, client, initialJournal, initialWarnings } = options

  const result: ImportResult = {
    runId,
    mode: config.mode,
    contacts: { created: 0, updated: 0, skipped: 0, failed: 0 },
    tags: { created: 0, skipped: 0 },
    contactTags: { created: 0, skipped: 0 },
    stoppedEarly: false,
    warnings: [...initialWarnings],
    journal: [...initialJournal],
  }

  // Validate mode: parse only, no client calls
  if (config.mode === 'validate') {
    result.contacts.skipped = contacts.length
    return result
  }

  // Rollback mode: emit rollback evidence, no mutations
  if (config.mode === 'rollback') {
    result.contacts.skipped = contacts.length
    return result
  }

  // Apply mode: confirmation token guard
  if (
    config.mode === 'apply' &&
    config.confirmationToken !== config.expectedConfirmationToken
  ) {
    result.stoppedEarly = true
    result.stopReason = 'confirmation_token_mismatch — apply blocked'
    return result
  }

  const tagState: TagResolutionState = {
    tagIdCache: new Map(),
    tagsCreated: 0,
    tagsSkipped: 0,
  }

  // Filter already-journaled contacts (resume support)
  const pending = contacts.filter((c) => !isAlreadyJournaled(c.email, initialJournal))

  // Apply batch limit
  const batch = pending.slice(0, config.batchLimit)

  for (const contact of batch) {
    const idempotencyKey = buildIdempotencyKey(contact.email)
    const mappedStatus = mapEmailStatus(contact.status)
    const mappedSource = mapSource(contact.source)
    const normalEmail = normaliseEmail(contact.email)

    let contactId: string
    let outcome: ImportJournalEntry['outcome']

    try {
      const existing = await client.findContactByEmail(normalEmail)

      if (existing) {
        // Consent preservation check
        const { status: safeStatus, consentConflict } = resolveEmailStatus(
          mappedStatus,
          existing.emailStatus,
        )
        if (consentConflict) {
          result.warnings.push(
            `consent_conflict on ${normalEmail}: incoming status '${mappedStatus}' would downgrade existing '${existing.emailStatus}' — preserving existing status`,
          )
        }

        const updateData: Record<string, unknown> = {
          emailStatus: safeStatus,
          source: mappedSource,
        }
        if (contact.firstName) updateData['firstName'] = contact.firstName
        if (contact.lastName) updateData['lastName'] = contact.lastName
        if (contact.company) updateData['company'] = contact.company
        if (contact.lastActivity) updateData['lastActivityAt'] = contact.lastActivity
        if (contact.consentAt && !consentConflict) {
          updateData['marketingConsentAt'] = contact.consentAt
        }

        if (config.mode === 'apply') {
          const updated = await client.updateContact(existing.id, updateData)
          contactId = updated.id
        } else {
          // dry-run: simulate
          contactId = existing.id
        }

        outcome = 'updated'
        result.contacts.updated++
      } else {
        // New contact
        const createData: Record<string, unknown> = {
          email: normalEmail,
          emailStatus: mappedStatus,
          lifecycleStage: 'lead',
          source: mappedSource,
        }
        if (contact.firstName) createData['firstName'] = contact.firstName
        if (contact.lastName) createData['lastName'] = contact.lastName
        if (contact.company) createData['company'] = contact.company
        if (contact.createdAt) createData['createdAt'] = contact.createdAt
        if (contact.lastActivity) createData['lastActivityAt'] = contact.lastActivity
        if (contact.consentAt) createData['marketingConsentAt'] = contact.consentAt

        if (config.mode === 'apply') {
          const created = await client.createContact(createData)
          contactId = created.id
        } else {
          // dry-run: synthetic ID
          contactId = `dry-run-contact-${idempotencyKey.slice(0, 8)}`
        }

        outcome = 'created'
        result.contacts.created++
      }
    } catch (e) {
      const error = `contact_upsert_failed: ${e instanceof Error ? e.message : String(e)}`
      const entry: ImportJournalEntry = {
        runId,
        email: normalEmail,
        idempotencyKey,
        outcome: 'failed',
        error,
        timestamp: new Date().toISOString(),
      }
      recordJournalEntry(entry, result, config.journalPath)
      result.contacts.failed++
      result.stoppedEarly = true
      result.stopReason = `critical_failure on ${normalEmail}: ${error}`
      return result
    }

    // Tag resolution — tags first, then lists (with list source prefix)
    const allTagNames: Array<{ name: string; sourceOverride: string | null }> = [
      ...contact.tags.map((t): { name: string; sourceOverride: string | null } => ({ name: t, sourceOverride: null })),
      ...contact.lists.map((l): { name: string; sourceOverride: string | null } => ({ name: l, sourceOverride: 'fluentcrm_list' })),
    ]

    for (const { name, sourceOverride } of allTagNames) {
      try {
        const tagId = await resolveOrCreateTag(
          name,
          sourceOverride,
          config.mode,
          client,
          tagState,
          result.warnings,
        )
        if (!tagId) continue

        // Idempotent contact-tag join
        const existingLink = await client.findContactTag(contactId, tagId)
        if (existingLink) {
          result.contactTags.skipped++
        } else if (config.mode === 'apply') {
          await client.createContactTag({
            displayName: `${normalEmail} — ${name}`,
            contact: contactId,
            tag: tagId,
            source: sourceOverride ? 'migration' : 'migration',
            sourceId: runId,
          })
          result.contactTags.created++
        } else {
          // dry-run: count but don't mutate
          result.contactTags.created++
        }
      } catch (e) {
        result.warnings.push(
          `tag_assignment_failed for ${normalEmail} tag "${name}": ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }

    const entry: ImportJournalEntry = {
      runId,
      email: normalEmail,
      idempotencyKey,
      outcome,
      payloadContactId: contactId,
      timestamp: new Date().toISOString(),
    }
    recordJournalEntry(entry, result, config.journalPath)
  }

  // Flush tag stats back to result
  result.tags.created = tagState.tagsCreated
  result.tags.skipped = tagState.tagsSkipped

  // Contacts that were already in the journal count as skipped for this run
  const resumedCount = contacts.length - pending.length
  result.contacts.skipped += resumedCount

  return result
}

// ─── Rollback evidence ────────────────────────────────────────────────────────

export function rollbackEvidence(result: ImportResult): string {
  const created = result.journal.filter((e) => e.outcome === 'created')
  const updated = result.journal.filter((e) => e.outcome === 'updated')

  const lines = [
    '# FluentCRM Import Rollback Evidence',
    '',
    `- Run ID: ${result.runId}`,
    `- Mode: ${result.mode}`,
    `- Contacts created: ${result.contacts.created}`,
    `- Contacts updated: ${result.contacts.updated}`,
    `- Stopped early: ${result.stoppedEarly}`,
    `- Stop reason: ${result.stopReason ?? 'none'}`,
    '',
    '## Contacts created (reversible by deletion)',
    '',
    '| Email | Payload Contact ID | Idempotency Key |',
    '| --- | --- | --- |',
  ]

  for (const e of created) {
    lines.push(`| ${e.email} | ${e.payloadContactId ?? 'unknown'} | ${e.idempotencyKey} |`)
  }

  lines.push(
    '',
    '## Contacts updated (original state not stored — manual verification required)',
    '',
    '| Email | Payload Contact ID | Idempotency Key |',
    '| --- | --- | --- |',
  )

  for (const e of updated) {
    lines.push(`| ${e.email} | ${e.payloadContactId ?? 'unknown'} | ${e.idempotencyKey} |`)
  }

  lines.push(
    '',
    '## Rollback procedure',
    '',
    'Created contacts: delete each Payload contact ID listed above.',
    'Updated contacts: original field values are not stored by this importer.',
    'Restore from a Payload backup snapshot taken before this run.',
    '',
    'This evidence was generated automatically — operator must confirm correctness',
    'before executing rollback.',
  )

  return lines.join('\n')
}

// ─── Reconciliation report ────────────────────────────────────────────────────

export function reconciliationReport(result: ImportResult): string {
  const lines = [
    '# FluentCRM Import Reconciliation Report',
    '',
    `- Run ID: ${result.runId}`,
    `- Mode: ${result.mode}`,
    `- Stopped early: ${result.stoppedEarly}`,
    `- Stop reason: ${result.stopReason ?? 'none'}`,
    '',
    '## Contacts',
    `- Created: ${result.contacts.created}`,
    `- Updated: ${result.contacts.updated}`,
    `- Skipped (journaled/resumed): ${result.contacts.skipped}`,
    `- Failed: ${result.contacts.failed}`,
    '',
    '## Tags',
    `- Created: ${result.tags.created}`,
    `- Skipped (already existed): ${result.tags.skipped}`,
    '',
    '## Contact-tag assignments',
    `- Created: ${result.contactTags.created}`,
    `- Skipped (already existed): ${result.contactTags.skipped}`,
    '',
    '## Warnings',
  ]

  if (result.warnings.length === 0) {
    lines.push('- none')
  } else {
    for (const w of result.warnings) {
      lines.push(`- ${w}`)
    }
  }

  return lines.join('\n')
}

// ─── Top-level entry point ────────────────────────────────────────────────────

/**
 * Primary entry point. Reads the file at config.inputPath from disk,
 * parses it, deduplicates, and runs the import against the provided client.
 *
 * Callers that manage their own file I/O can use runImport() directly.
 */
export async function importFromFile(
  config: FluentCrmImportConfig,
  client: PayloadCrmClient,
  runId?: string,
): Promise<ImportResult> {
  const resolvedRunId = runId ?? `fluentcrm-import-${Date.now()}`

  const raw = readFileSync(config.inputPath, 'utf8')

  let parsed: ParsedInput
  if (config.format === 'csv') {
    parsed = parseCsvInput(raw)
  } else {
    parsed = parseJsonInput(raw)
  }

  const deduplicated = deduplicateContacts(parsed.contacts, parsed.warnings)

  const initialJournal = config.journalPath
    ? loadJournalFromFile(config.journalPath)
    : []

  return runImport({
    runId: resolvedRunId,
    contacts: deduplicated,
    config,
    client,
    initialJournal,
    initialWarnings: parsed.warnings,
  })
}
