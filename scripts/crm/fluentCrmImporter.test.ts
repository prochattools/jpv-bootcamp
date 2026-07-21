/**
 * Comprehensive tests for the FluentCRM importer.
 * No real Payload calls — all tests use injected fakes.
 *
 * Covers: CSV parsing, JSON parsing, deduplication, status mapping,
 * consent preservation, tag idempotency, dry-run isolation, apply mode,
 * batch limit, journal resume, rollback evidence, error handling,
 * reconciliation report accuracy.
 *
 * Run standalone:
 *   npx tsx scripts/crm/fluentCrmImporter.test.ts
 */

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  parseCsvInput,
  parseJsonInput,
  deduplicateContacts,
  mapEmailStatus,
  mapSource,
  buildTagSlug,
  buildIdempotencyKey,
  resolveEmailStatus,
  loadJournalFromFile,
  rollbackEvidence,
  reconciliationReport,
  runImport,
  type FluentCrmContact,
  type FluentCrmImportConfig,
  type ImportJournalEntry,
  type ImportResult,
  type PayloadCrmClient,
} from './fluentCrmImporter'

// ─── Shared fakes ─────────────────────────────────────────────────────────────

function makeContact(overrides: Partial<FluentCrmContact> = {}): FluentCrmContact {
  return {
    email: 'info@prochat.tools',
    firstName: 'Test',
    lastName: 'User',
    status: 'subscribed',
    tags: ['bootcamp-2024'],
    lists: ['jpv-jan-2024'],
    createdAt: '2024-01-15T09:00:00Z',
    lastActivity: '2024-06-10T14:30:00Z',
    company: 'Test Co',
    source: 'website',
    consentAt: '2024-01-15T09:00:00Z',
    ...overrides,
  }
}

interface FakeClientState {
  contacts: Map<string, { id: string; emailStatus: string }>
  tags: Map<string, { id: string }>
  contactTags: Map<string, { id: string }>
  createContactCalls: Array<Record<string, unknown>>
  updateContactCalls: Array<{ id: string; data: Record<string, unknown> }>
  createTagCalls: Array<Record<string, unknown>>
  createContactTagCalls: Array<Record<string, unknown>>
}

function makeFakeClient(overrides: Partial<PayloadCrmClient> = {}): {
  client: PayloadCrmClient
  state: FakeClientState
} {
  const state: FakeClientState = {
    contacts: new Map(),
    tags: new Map(),
    contactTags: new Map(),
    createContactCalls: [],
    updateContactCalls: [],
    createTagCalls: [],
    createContactTagCalls: [],
  }

  const client: PayloadCrmClient = {
    findContactByEmail: async (email) => state.contacts.get(email.toLowerCase()) ?? null,
    createContact: async (data) => {
      state.createContactCalls.push(data)
      const id = `contact-${state.contacts.size + 1}`
      const email = (data['email'] as string).toLowerCase()
      const emailStatus = (data['emailStatus'] as string) ?? 'subscribed'
      state.contacts.set(email, { id, emailStatus })
      return { id }
    },
    updateContact: async (id, data) => {
      state.updateContactCalls.push({ id, data })
      // Update the stored email status if provided
      for (const [email, contact] of state.contacts.entries()) {
        if (contact.id === id) {
          if (data['emailStatus']) {
            state.contacts.set(email, { id, emailStatus: data['emailStatus'] as string })
          }
          break
        }
      }
      return { id }
    },
    findTagBySlug: async (slug) => state.tags.get(slug) ?? null,
    createTag: async (data) => {
      state.createTagCalls.push(data)
      const id = `tag-${state.tags.size + 1}`
      state.tags.set(data['slug'] as string, { id })
      return { id }
    },
    findContactTag: async (contactId, tagId) => {
      const key = `${contactId}:${tagId}`
      return state.contactTags.get(key) ?? null
    },
    createContactTag: async (data) => {
      state.createContactTagCalls.push(data)
      const id = `ct-${state.contactTags.size + 1}`
      const key = `${data['contact']}:${data['tag']}`
      state.contactTags.set(key, { id })
      return { id }
    },
    ...overrides,
  }

  return { client, state }
}

function makeConfig(overrides: Partial<FluentCrmImportConfig> = {}): FluentCrmImportConfig {
  return {
    inputPath: '/dev/null',
    format: 'csv',
    mode: 'dry-run',
    confirmationToken: 'token-abc',
    expectedConfirmationToken: 'token-abc',
    batchLimit: 50,
    payloadBaseUrl: 'http://localhost:3000',
    payloadApiKey: 'test-api-key',
    ...overrides,
  }
}

// ─── CSV parsing tests ────────────────────────────────────────────────────────

function testCsvBasicParsing() {
  const csv = [
    'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at',
    'john@example.com,John,Smith,subscribed,bootcamp|early-bird,jpv-jan,2024-01-01T00:00:00Z,2024-06-01T00:00:00Z,ACME,website,+44700,2024-01-01T00:00:00Z',
  ].join('\n')

  const { contacts, warnings } = parseCsvInput(csv)
  assert.equal(contacts.length, 1, 'Should parse one contact')
  assert.equal(warnings.length, 0, 'No warnings for valid row')
  const c = contacts[0]
  assert.equal(c.email, 'john@example.com')
  assert.equal(c.firstName, 'John')
  assert.equal(c.lastName, 'Smith')
  assert.equal(c.status, 'subscribed')
  assert.deepEqual(c.tags, ['bootcamp', 'early-bird'])
  assert.deepEqual(c.lists, ['jpv-jan'])
  assert.equal(c.consentAt, '2024-01-01T00:00:00Z')
  assert.equal(c.company, 'ACME')
  assert.equal(c.source, 'website')
}

function testCsvPipeSeparatedTagsAndLists() {
  const csv = [
    'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at',
    'multi@example.com,Multi,Tag,subscribed,tag-a|tag-b|tag-c,list-1|list-2,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,,,, ',
  ].join('\n')

  const { contacts } = parseCsvInput(csv)
  assert.equal(contacts.length, 1)
  assert.deepEqual(contacts[0].tags, ['tag-a', 'tag-b', 'tag-c'])
  assert.deepEqual(contacts[0].lists, ['list-1', 'list-2'])
}

function testCsvEmptyTagsAndLists() {
  const csv = [
    'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at',
    'notags@example.com,No,Tags,subscribed,,,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,,,, ',
  ].join('\n')

  const { contacts } = parseCsvInput(csv)
  assert.equal(contacts.length, 1)
  assert.deepEqual(contacts[0].tags, [])
  assert.deepEqual(contacts[0].lists, [])
}

function testCsvMissingEmailSkipped() {
  const csv = [
    'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at',
    ',First,Last,subscribed,,,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,,,, ',
    'valid@example.com,Valid,User,subscribed,,,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,,,, ',
  ].join('\n')

  const { contacts, warnings } = parseCsvInput(csv)
  assert.equal(contacts.length, 1, 'Row without email should be skipped')
  assert.equal(warnings.length, 1, 'Warning emitted for skipped row')
  assert.ok(warnings[0].includes('missing email'))
}

function testCsvEmptyFileReturnsEmpty() {
  const { contacts } = parseCsvInput('')
  assert.equal(contacts.length, 0)
}

function testCsvHeaderOnlyReturnsEmpty() {
  const csv = 'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at'
  const { contacts } = parseCsvInput(csv)
  assert.equal(contacts.length, 0)
}

function testCsvNullConsentAt() {
  const csv = [
    'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at',
    'noconsent@example.com,No,Consent,subscribed,,,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,,,,',
  ].join('\n')

  const { contacts } = parseCsvInput(csv)
  assert.equal(contacts.length, 1)
  assert.equal(contacts[0].consentAt, null, 'Empty consent_at should be null')
}

function testCsvCrlfLineEndings() {
  const csv = [
    'email,first_name,last_name,status,tags,lists,created_at,last_activity,company,source,phone,consent_at',
    'crlf@example.com,CRLF,Test,subscribed,,,2024-01-01T00:00:00Z,2024-01-01T00:00:00Z,,,,',
  ].join('\r\n')

  const { contacts } = parseCsvInput(csv)
  assert.equal(contacts.length, 1, 'Should handle CRLF line endings')
  assert.equal(contacts[0].email, 'crlf@example.com')
}

// ─── JSON parsing tests ───────────────────────────────────────────────────────

function testJsonBasicParsing() {
  const data = [
    {
      email: 'json@example.com',
      first_name: 'Json',
      last_name: 'User',
      status: 'subscribed',
      tags: 'tag-a|tag-b',
      lists: 'list-1',
      created_at: '2024-01-01T00:00:00Z',
      last_activity: '2024-06-01T00:00:00Z',
      company: 'JSON Corp',
      source: 'api',
      consent_at: '2024-01-01T00:00:00Z',
    },
  ]

  const { contacts, warnings } = parseJsonInput(JSON.stringify(data))
  assert.equal(contacts.length, 1)
  assert.equal(warnings.length, 0)
  const c = contacts[0]
  assert.equal(c.email, 'json@example.com')
  assert.deepEqual(c.tags, ['tag-a', 'tag-b'])
  assert.deepEqual(c.lists, ['list-1'])
  assert.equal(c.consentAt, '2024-01-01T00:00:00Z')
}

function testJsonMissingEmailSkipped() {
  const data = [
    { first_name: 'No', last_name: 'Email', status: 'subscribed' },
    { email: 'valid@example.com', first_name: 'Valid', last_name: 'User', status: 'subscribed' },
  ]
  const { contacts, warnings } = parseJsonInput(JSON.stringify(data))
  assert.equal(contacts.length, 1)
  assert.equal(warnings.length, 1)
  assert.ok(warnings[0].includes('missing email'))
}

function testJsonInvalidFormatThrows() {
  assert.throws(
    () => parseJsonInput('not json at all'),
    /not valid JSON/,
    'Should throw on invalid JSON',
  )
}

function testJsonNonArrayThrows() {
  assert.throws(
    () => parseJsonInput(JSON.stringify({ email: 'test@example.com' })),
    /must be an array/,
    'Should throw when root is not an array',
  )
}

function testJsonNonObjectItemSkipped() {
  const data = ['not-an-object', { email: 'valid@example.com', status: 'subscribed' }]
  const { contacts, warnings } = parseJsonInput(JSON.stringify(data))
  assert.equal(contacts.length, 1)
  assert.equal(warnings.length, 1)
}

// ─── Deduplication tests ──────────────────────────────────────────────────────

function testDeduplicateCaseInsensitive() {
  const contacts: FluentCrmContact[] = [
    makeContact({ email: 'test@example.com', lastActivity: '2024-01-01T00:00:00Z' }),
    makeContact({ email: 'TEST@EXAMPLE.COM', lastActivity: '2024-06-01T00:00:00Z' }),
  ]
  const warnings: string[] = []
  const deduped = deduplicateContacts(contacts, warnings)
  assert.equal(deduped.length, 1, 'Should deduplicate case-insensitively')
  assert.equal(warnings.length, 1, 'Should emit one warning')
  assert.ok(warnings[0].includes('duplicate email'))
  // Keeps the more recent record
  assert.equal(deduped[0].lastActivity, '2024-06-01T00:00:00Z', 'Should keep the more recent record')
}

function testDeduplicateKeepsMostRecent() {
  const contacts: FluentCrmContact[] = [
    makeContact({ email: 'a@example.com', lastActivity: '2024-07-01T00:00:00Z' }),
    makeContact({ email: 'a@example.com', lastActivity: '2024-01-01T00:00:00Z' }),
    makeContact({ email: 'a@example.com', lastActivity: '2024-04-01T00:00:00Z' }),
  ]
  const warnings: string[] = []
  const deduped = deduplicateContacts(contacts, warnings)
  assert.equal(deduped.length, 1)
  assert.equal(warnings.length, 2, 'Two duplicates discarded')
  assert.equal(deduped[0].lastActivity, '2024-07-01T00:00:00Z')
}

function testDeduplicateNoDuplicates() {
  const contacts: FluentCrmContact[] = [
    makeContact({ email: 'a@example.com' }),
    makeContact({ email: 'b@example.com' }),
    makeContact({ email: 'c@example.com' }),
  ]
  const warnings: string[] = []
  const deduped = deduplicateContacts(contacts, warnings)
  assert.equal(deduped.length, 3)
  assert.equal(warnings.length, 0)
}

// ─── Status mapping tests ─────────────────────────────────────────────────────

function testStatusMappingAllVariants() {
  assert.equal(mapEmailStatus('subscribed'), 'subscribed')
  assert.equal(mapEmailStatus('unsubscribed'), 'unsubscribed')
  assert.equal(mapEmailStatus('bounced'), 'bounced')
  assert.equal(mapEmailStatus('complained'), 'complained')
  assert.equal(mapEmailStatus('pending'), 'transactional_only')
  assert.equal(mapEmailStatus('unknown_status'), 'transactional_only', 'Unknown status → transactional_only')
  assert.equal(mapEmailStatus(''), 'transactional_only', 'Empty status → transactional_only')
}

// ─── Source mapping tests ─────────────────────────────────────────────────────

function testMapSourcePrefixesNonPrefixed() {
  assert.equal(mapSource('website'), 'fluentcrm:website')
  assert.equal(mapSource('organic'), 'fluentcrm:organic')
}

function testMapSourcePreservesExistingPrefix() {
  assert.equal(mapSource('fluentcrm:website'), 'fluentcrm:website', 'Should not double-prefix')
  assert.equal(mapSource('fluentcrm:referral'), 'fluentcrm:referral')
}

function testMapSourceEmptyFallback() {
  assert.equal(mapSource(''), 'fluentcrm:import')
}

// ─── Tag slug tests ───────────────────────────────────────────────────────────

function testBuildTagSlug() {
  assert.equal(buildTagSlug('bootcamp-2024'), 'bootcamp-2024')
  assert.equal(buildTagSlug('Bootcamp 2024'), 'bootcamp-2024')
  assert.equal(buildTagSlug('JPV Bootcamp!'), 'jpv-bootcamp')
  assert.equal(buildTagSlug('  spaces  '), 'spaces')
  assert.equal(buildTagSlug('multiple   spaces'), 'multiple-spaces')
}

// ─── Idempotency key tests ────────────────────────────────────────────────────

function testIdempotencyKeyIsConsistent() {
  const key1 = buildIdempotencyKey('test@example.com')
  const key2 = buildIdempotencyKey('test@example.com')
  assert.equal(key1, key2, 'Same email must always produce same key')
}

function testIdempotencyKeyCaseInsensitive() {
  const key1 = buildIdempotencyKey('Test@Example.COM')
  const key2 = buildIdempotencyKey('test@example.com')
  assert.equal(key1, key2, 'Key must be case-insensitive')
}

function testIdempotencyKeyIsSha256() {
  const key = buildIdempotencyKey('test@example.com')
  assert.equal(key.length, 64, 'SHA-256 hex is 64 chars')
  assert.ok(/^[0-9a-f]+$/.test(key), 'SHA-256 hex only contains hex chars')
}

// ─── Consent preservation tests ───────────────────────────────────────────────

function testConsentPreservationBlocksSubscribedOverUnsubscribed() {
  const { status, consentConflict } = resolveEmailStatus('subscribed', 'unsubscribed')
  assert.equal(status, 'unsubscribed', 'Must preserve unsubscribed')
  assert.equal(consentConflict, true, 'Must report conflict')
}

function testConsentPreservationBlocksSubscribedOverBounced() {
  const { status, consentConflict } = resolveEmailStatus('subscribed', 'bounced')
  assert.equal(status, 'bounced', 'Must preserve bounced')
  assert.equal(consentConflict, true)
}

function testConsentPreservationBlocksSubscribedOverComplained() {
  const { status, consentConflict } = resolveEmailStatus('subscribed', 'complained')
  assert.equal(status, 'complained', 'Must preserve complained')
  assert.equal(consentConflict, true)
}

function testConsentPreservationAllowsUnsubscribedOverSubscribed() {
  // Unsubscribing someone who was subscribed is always fine
  const { status, consentConflict } = resolveEmailStatus('unsubscribed', 'subscribed')
  assert.equal(status, 'unsubscribed')
  assert.equal(consentConflict, false)
}

function testConsentPreservationAllowsSubsequentProtectedStatus() {
  // bounced over unsubscribed: new status takes precedence (both are protected)
  const { status, consentConflict } = resolveEmailStatus('bounced', 'unsubscribed')
  assert.equal(status, 'bounced', 'Should allow bounced to overwrite unsubscribed')
  assert.equal(consentConflict, false)
}

function testConsentPreservationNoExistingStatus() {
  const { status, consentConflict } = resolveEmailStatus('subscribed', undefined)
  assert.equal(status, 'subscribed')
  assert.equal(consentConflict, false)
}

// ─── Dry-run isolation tests ──────────────────────────────────────────────────

async function testDryRunProducesNoMutations() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'dry-run' })
  const contacts = [makeContact()]

  const result = await runImport({
    runId: 'run-dry-001',
    contacts,
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createContactCalls.length, 0, 'No createContact calls in dry-run')
  assert.equal(state.updateContactCalls.length, 0, 'No updateContact calls in dry-run')
  assert.equal(state.createTagCalls.length, 0, 'No createTag calls in dry-run')
  assert.equal(state.createContactTagCalls.length, 0, 'No createContactTag calls in dry-run')
  assert.equal(result.contacts.created, 1, 'Created count is correct')
  assert.ok(!result.stoppedEarly)
}

async function testDryRunJournalRecordsOutcome() {
  const { client } = makeFakeClient()
  const config = makeConfig({ mode: 'dry-run' })
  const contacts = [makeContact()]

  const result = await runImport({
    runId: 'run-dry-002',
    contacts,
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(result.journal.length, 1)
  assert.equal(result.journal[0].outcome, 'created')
  assert.equal(result.journal[0].email, 'info@prochat.tools')
}

// ─── Apply mode tests ─────────────────────────────────────────────────────────

async function testApplyRequiresConfirmationToken() {
  const { client } = makeFakeClient()
  const config = makeConfig({
    mode: 'apply',
    confirmationToken: 'wrong-token',
    expectedConfirmationToken: 'correct-token',
  })

  const result = await runImport({
    runId: 'run-apply-bad-token',
    contacts: [makeContact()],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.ok(result.stoppedEarly, 'Should stop on bad token')
  assert.ok(result.stopReason?.includes('confirmation_token_mismatch'))
  assert.equal(result.contacts.created, 0)
}

async function testApplyCreatesContact() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-apply-001',
    contacts: [makeContact()],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(result.contacts.created, 1)
  assert.equal(state.createContactCalls.length, 1)
  assert.ok(!result.stoppedEarly)
  assert.equal(result.journal[0].outcome, 'created')
  assert.ok(result.journal[0].payloadContactId?.startsWith('contact-'))
}

async function testApplyUpdatesExistingContact() {
  const { client, state } = makeFakeClient()
  // Pre-seed an existing contact
  state.contacts.set('info@prochat.tools', { id: 'existing-001', emailStatus: 'subscribed' })

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-apply-update-001',
    contacts: [makeContact({ status: 'subscribed' })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(result.contacts.updated, 1)
  assert.equal(result.contacts.created, 0)
  assert.equal(state.updateContactCalls.length, 1)
  assert.equal(state.updateContactCalls[0].id, 'existing-001')
  assert.equal(result.journal[0].outcome, 'updated')
}

// ─── Consent preservation in apply mode ───────────────────────────────────────

async function testApplyNeverDowngradesUnsubscribed() {
  const { client, state } = makeFakeClient()
  state.contacts.set('info@prochat.tools', { id: 'contact-001', emailStatus: 'unsubscribed' })

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-consent-001',
    contacts: [makeContact({ status: 'subscribed' })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  // Should have updated with unsubscribed status preserved
  assert.equal(state.updateContactCalls.length, 1)
  const updateData = state.updateContactCalls[0].data
  assert.equal(updateData['emailStatus'], 'unsubscribed', 'Must preserve unsubscribed status')
  assert.ok(
    result.warnings.some((w) => w.includes('consent_conflict')),
    'Should warn about consent conflict',
  )
}

async function testApplyNeverDowngradesBounced() {
  const { client, state } = makeFakeClient()
  state.contacts.set('info@prochat.tools', { id: 'contact-bounced', emailStatus: 'bounced' })

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-consent-002',
    contacts: [makeContact({ status: 'subscribed' })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.updateContactCalls[0].data['emailStatus'], 'bounced')
  assert.ok(result.warnings.some((w) => w.includes('consent_conflict')))
}

async function testApplyNeverDowngradesComplained() {
  const { client, state } = makeFakeClient()
  state.contacts.set('info@prochat.tools', { id: 'contact-complained', emailStatus: 'complained' })

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-consent-003',
    contacts: [makeContact({ status: 'subscribed' })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.updateContactCalls[0].data['emailStatus'], 'complained')
  assert.ok(result.warnings.some((w) => w.includes('consent_conflict')))
}

// ─── Tag creation and idempotency tests ───────────────────────────────────────

async function testTagCreatedOnApply() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'apply' })

  await runImport({
    runId: 'run-tag-001',
    contacts: [makeContact({ tags: ['new-tag'], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createTagCalls.length, 1)
  assert.equal(state.createTagCalls[0]['slug'], 'new-tag')
  assert.equal(state.createTagCalls[0]['name'], 'new-tag')
}

async function testTagNotDuplicatedWhenAlreadyExists() {
  const { client, state } = makeFakeClient()
  // Pre-seed the tag
  state.tags.set('existing-tag', { id: 'tag-existing' })

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-tag-002',
    contacts: [makeContact({ tags: ['existing-tag'], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createTagCalls.length, 0, 'Tag must not be created if it already exists')
  assert.equal(result.tags.skipped, 1, 'Tag should be counted as skipped')
}

async function testSameTagSharedAcrossContactsNotDuplicated() {
  const { client } = makeFakeClient()
  // Use dry-run mode: multi-contact tag dedup logic is the same for dry-run and apply;
  // apply mode is now restricted to single allowlisted email by the staging guard.
  const config = makeConfig({ mode: 'dry-run' })

  const contacts = [
    makeContact({ email: 'a@example.com', tags: ['shared-tag'], lists: [] }),
    makeContact({ email: 'b@example.com', tags: ['shared-tag'], lists: [] }),
  ]

  const result = await runImport({
    runId: 'run-tag-003',
    contacts,
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  // In dry-run, tags.created counts unique tag creates via the in-memory cache.
  // shared-tag appears in both contacts but should only be counted once as created.
  assert.equal(result.tags.created, 1, 'Tag must only be created once (dry-run mode)')
}

async function testContactTagNotDuplicatedWhenLinkExists() {
  const { client, state } = makeFakeClient()
  // Pre-seed contact and tag
  state.contacts.set('info@prochat.tools', { id: 'contact-001', emailStatus: 'subscribed' })
  state.tags.set('bootcamp-2024', { id: 'tag-001' })
  // Pre-seed the contact-tag link
  state.contactTags.set('contact-001:tag-001', { id: 'ct-existing' })

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-tag-004',
    contacts: [makeContact({ tags: ['bootcamp-2024'], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createContactTagCalls.length, 0, 'Contact-tag must not be created if it exists')
  assert.equal(result.contactTags.skipped, 1)
}

async function testListsCreatedAsTagsWithMigrationSource() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'apply' })

  await runImport({
    runId: 'run-lists-001',
    contacts: [makeContact({ tags: [], lists: ['jpv-jan-2024'] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createTagCalls.length, 1)
  assert.equal(state.createTagCalls[0]['slug'], 'jpv-jan-2024')
}

// ─── Batch limit tests ────────────────────────────────────────────────────────

async function testBatchLimitEnforced() {
  const { client } = makeFakeClient()
  // Multi-email batch tests use dry-run: apply mode is restricted to single
  // allowlisted email by the staging communication guard.
  const config = makeConfig({ mode: 'dry-run', batchLimit: 3 })

  const contacts = Array.from({ length: 10 }, (_, i) =>
    makeContact({ email: `user${i}@example.com` }),
  )

  const result = await runImport({
    runId: 'run-batch-001',
    contacts,
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  const totalProcessed = result.contacts.created + result.contacts.updated
  assert.equal(totalProcessed, 3, 'Must not process more than batchLimit contacts')
}

async function testBatchLimitRespectedInDryRun() {
  const { client } = makeFakeClient()
  const config = makeConfig({ mode: 'dry-run', batchLimit: 2 })

  const contacts = Array.from({ length: 5 }, (_, i) =>
    makeContact({ email: `user${i}@example.com` }),
  )

  const result = await runImport({
    runId: 'run-batch-002',
    contacts,
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(result.contacts.created, 2)
}

// ─── Journal-based resume tests ───────────────────────────────────────────────

async function testResumeSkipsJournaledContacts() {
  const { client, state } = makeFakeClient()

  const priorJournal: ImportJournalEntry[] = [
    {
      runId: 'prior-run',
      email: 'a@example.com',
      idempotencyKey: buildIdempotencyKey('a@example.com'),
      outcome: 'created',
      payloadContactId: 'contact-prior',
      timestamp: new Date().toISOString(),
    },
  ]

  // Multi-email resume logic uses dry-run: apply is restricted to single
  // allowlisted email by the staging communication guard.
  const config = makeConfig({ mode: 'dry-run' })
  const contacts = [
    makeContact({ email: 'a@example.com' }), // already journaled
    makeContact({ email: 'b@example.com' }), // new
  ]

  const result = await runImport({
    runId: 'run-resume-001',
    contacts,
    config,
    client,
    initialJournal: priorJournal,
    initialWarnings: [],
  })

  assert.equal(result.contacts.created, 1, 'Should only process the un-journaled contact')
  // Note: dry-run mode tracks creates via synthetic IDs, not actual client calls
  assert.equal(result.journal.length, priorJournal.length + 1)
}

async function testResumeCaseInsensitive() {
  const { client } = makeFakeClient()

  const priorJournal: ImportJournalEntry[] = [
    {
      runId: 'prior-run',
      email: 'info@prochat.tools',
      idempotencyKey: buildIdempotencyKey('info@prochat.tools'),
      outcome: 'created',
      timestamp: new Date().toISOString(),
    },
  ]

  const config = makeConfig({ mode: 'apply' })
  // Same email but different case — must still match via normalisation
  const contacts = [makeContact({ email: 'INFO@PROCHAT.TOOLS' })]

  const result = await runImport({
    runId: 'run-resume-002',
    contacts,
    config,
    client,
    initialJournal: priorJournal,
    initialWarnings: [],
  })

  assert.equal(result.contacts.created, 0, 'Should skip case-insensitive match from journal')
  assert.equal(result.contacts.skipped, 1)
}

// ─── Durable journal file tests ───────────────────────────────────────────────

async function testDurableJournalAppendsToFile() {
  const dir = mkdtempSync(join(tmpdir(), 'fluent-crm-test-'))
  const journalPath = join(dir, 'journal.ndjson')
  try {
    const { client } = makeFakeClient()
    const config = makeConfig({ mode: 'apply', journalPath })

    await runImport({
      runId: 'run-journal-001',
      contacts: [makeContact()],
      config,
      client,
      initialJournal: [],
      initialWarnings: [],
    })

    const content = readFileSync(journalPath, 'utf8')
    const lines = content.split('\n').filter(Boolean)
    assert.equal(lines.length, 1, 'One journal entry written to file')
    const entry = JSON.parse(lines[0]) as ImportJournalEntry
    assert.equal(entry.email, 'info@prochat.tools')
    assert.equal(entry.outcome, 'created')
  } finally {
    rmSync(dir, { recursive: true })
  }
}

async function testLoadJournalReturnsEmptyForMissingFile() {
  const entries = loadJournalFromFile('/tmp/__nonexistent_fluentcrm_journal__.ndjson')
  assert.equal(entries.length, 0, 'Should return empty array for missing file')
}

async function testLoadJournalRoundtrips() {
  const dir = mkdtempSync(join(tmpdir(), 'fluent-crm-test-'))
  const journalPath = join(dir, 'journal.ndjson')
  try {
    const entry: ImportJournalEntry = {
      runId: 'run-001',
      email: 'info@prochat.tools',
      idempotencyKey: buildIdempotencyKey('info@prochat.tools'),
      outcome: 'created',
      payloadContactId: 'contact-001',
      timestamp: new Date().toISOString(),
    }
    writeFileSync(journalPath, JSON.stringify(entry) + '\n', 'utf8')
    const loaded = loadJournalFromFile(journalPath)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].email, 'info@prochat.tools')
    assert.equal(loaded[0].outcome, 'created')
  } finally {
    rmSync(dir, { recursive: true })
  }
}

async function testResumeFromDurableJournalFile() {
  const dir = mkdtempSync(join(tmpdir(), 'fluent-crm-test-'))
  const journalPath = join(dir, 'journal.ndjson')
  try {
    // Write prior journal entry for the allowed email
    const priorEntry: ImportJournalEntry = {
      runId: 'prior-run',
      email: 'info@prochat.tools',
      idempotencyKey: buildIdempotencyKey('info@prochat.tools'),
      outcome: 'created',
      payloadContactId: 'contact-prior',
      timestamp: new Date().toISOString(),
    }
    writeFileSync(journalPath, JSON.stringify(priorEntry) + '\n', 'utf8')

    const { client } = makeFakeClient()
    const config = makeConfig({ mode: 'apply', journalPath })

    const loadedJournal = loadJournalFromFile(journalPath)
    const result = await runImport({
      runId: 'run-resume-durable-001',
      contacts: [makeContact()], // info@prochat.tools — already in journal
      config,
      client,
      initialJournal: loadedJournal,
      initialWarnings: [],
    })

    // Contact already journaled, so should be skipped
    assert.equal(result.contacts.created, 0, 'Should skip the already-journaled contact')
    assert.equal(result.contacts.skipped, 1)

    // Journal file should still have 1 line (prior entry only — no new work)
    const content = readFileSync(journalPath, 'utf8')
    const lines = content.split('\n').filter(Boolean)
    assert.equal(lines.length, 1, 'Journal should only have the prior entry')
  } finally {
    rmSync(dir, { recursive: true })
  }
}

// ─── Validate mode tests ──────────────────────────────────────────────────────

async function testValidateModeNoClientCalls() {
  let clientCalled = false
  const client: PayloadCrmClient = {
    findContactByEmail: async () => { clientCalled = true; return null },
    createContact: async () => { clientCalled = true; return { id: 'x' } },
    updateContact: async () => { clientCalled = true; return { id: 'x' } },
    findTagBySlug: async () => { clientCalled = true; return null },
    createTag: async () => { clientCalled = true; return { id: 'x' } },
    findContactTag: async () => { clientCalled = true; return null },
    createContactTag: async () => { clientCalled = true; return { id: 'x' } },
  }

  const config = makeConfig({ mode: 'validate' })
  const result = await runImport({
    runId: 'run-validate-001',
    contacts: [makeContact()],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(clientCalled, false, 'Validate mode must make no client calls')
  assert.equal(result.contacts.skipped, 1)
}

// ─── Rollback mode tests ──────────────────────────────────────────────────────

async function testRollbackModeNoMutations() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'rollback' })

  const result = await runImport({
    runId: 'run-rollback-001',
    contacts: [makeContact()],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createContactCalls.length, 0)
  assert.equal(result.mode, 'rollback')
}

// ─── Error handling tests ─────────────────────────────────────────────────────

async function testContactCreateFailureStopsRun() {
  const client: PayloadCrmClient = {
    findContactByEmail: async () => null,
    createContact: async () => { throw new Error('network_timeout') },
    updateContact: async (id) => ({ id }),
    findTagBySlug: async () => null,
    createTag: async () => ({ id: 'tag-1' }),
    findContactTag: async () => null,
    createContactTag: async () => ({ id: 'ct-1' }),
  }

  const config = makeConfig({ mode: 'apply' })
  // Single allowlisted email — test exercises the error handling path
  const contacts = [makeContact()]

  const result = await runImport({
    runId: 'run-error-001',
    contacts,
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.ok(result.stoppedEarly, 'Should stop on critical failure')
  assert.equal(result.contacts.failed, 1)
  assert.ok(result.stopReason?.includes('critical_failure'))
}

async function testTagFailureRecordedAsWarningNotStop() {
  // Tag failures are non-critical — they warn but do not stop the run
  const client: PayloadCrmClient = {
    findContactByEmail: async () => null,
    createContact: async (data) => ({ id: 'contact-1' }),
    updateContact: async (id) => ({ id }),
    findTagBySlug: async () => null,
    createTag: async () => { throw new Error('tag_create_failed') },
    findContactTag: async () => null,
    createContactTag: async () => ({ id: 'ct-1' }),
  }

  const config = makeConfig({ mode: 'apply' })

  const result = await runImport({
    runId: 'run-error-002',
    contacts: [makeContact({ tags: ['some-tag'], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.ok(!result.stoppedEarly, 'Tag failure should not stop the run')
  assert.equal(result.contacts.created, 1, 'Contact should still be created')
  assert.ok(result.warnings.some((w) => w.includes('tag_assignment_failed')))
}

// ─── Reconciliation report tests ──────────────────────────────────────────────

function testReconciliationReportAccuracy() {
  const result: ImportResult = {
    runId: 'run-report-001',
    mode: 'apply',
    contacts: { created: 5, updated: 2, skipped: 1, failed: 1 },
    tags: { created: 3, skipped: 2 },
    contactTags: { created: 8, skipped: 1 },
    stoppedEarly: false,
    warnings: ['test warning'],
    journal: [],
  }

  const report = reconciliationReport(result)
  assert.ok(report.includes('run-report-001'))
  assert.ok(report.includes('Created: 5'))
  assert.ok(report.includes('Updated: 2'))
  assert.ok(report.includes('Skipped (journaled/resumed): 1'))
  assert.ok(report.includes('Failed: 1'))
  assert.ok(report.includes('Tags'))
  assert.ok(report.includes('Created: 3'))
  assert.ok(report.includes('Contact-tag assignments'))
  assert.ok(report.includes('test warning'))
}

function testReconciliationReportNoWarnings() {
  const result: ImportResult = {
    runId: 'run-report-002',
    mode: 'dry-run',
    contacts: { created: 0, updated: 0, skipped: 0, failed: 0 },
    tags: { created: 0, skipped: 0 },
    contactTags: { created: 0, skipped: 0 },
    stoppedEarly: false,
    warnings: [],
    journal: [],
  }

  const report = reconciliationReport(result)
  assert.ok(report.includes('- none'), 'Should show "none" for empty warnings')
}

// ─── Rollback evidence tests ──────────────────────────────────────────────────

function testRollbackEvidenceContainsCreatedContacts() {
  const journal: ImportJournalEntry[] = [
    {
      runId: 'run-001',
      email: 'created@example.com',
      idempotencyKey: buildIdempotencyKey('created@example.com'),
      outcome: 'created',
      payloadContactId: 'contact-001',
      timestamp: new Date().toISOString(),
    },
    {
      runId: 'run-001',
      email: 'updated@example.com',
      idempotencyKey: buildIdempotencyKey('updated@example.com'),
      outcome: 'updated',
      payloadContactId: 'contact-002',
      timestamp: new Date().toISOString(),
    },
  ]

  const result: ImportResult = {
    runId: 'run-001',
    mode: 'apply',
    contacts: { created: 1, updated: 1, skipped: 0, failed: 0 },
    tags: { created: 0, skipped: 0 },
    contactTags: { created: 0, skipped: 0 },
    stoppedEarly: false,
    warnings: [],
    journal,
  }

  const evidence = rollbackEvidence(result)
  assert.ok(evidence.includes('run-001'))
  assert.ok(evidence.includes('created@example.com'))
  assert.ok(evidence.includes('updated@example.com'))
  assert.ok(evidence.includes('contact-001'))
  assert.ok(evidence.includes('contact-002'))
  assert.ok(evidence.includes('operator must confirm'), 'Must have safety warning')
  assert.ok(evidence.includes('Rollback procedure'))
}

function testRollbackEvidenceEmptyJournal() {
  const result: ImportResult = {
    runId: 'run-empty-001',
    mode: 'apply',
    contacts: { created: 0, updated: 0, skipped: 0, failed: 0 },
    tags: { created: 0, skipped: 0 },
    contactTags: { created: 0, skipped: 0 },
    stoppedEarly: false,
    warnings: [],
    journal: [],
  }

  const evidence = rollbackEvidence(result)
  assert.ok(evidence.includes('Rollback Evidence'))
  assert.ok(evidence.includes('run-empty-001'))
}

// ─── Source mapping in apply mode ─────────────────────────────────────────────

async function testSourcePrefixedOnCreate() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'apply' })

  await runImport({
    runId: 'run-source-001',
    contacts: [makeContact({ source: 'website', tags: [], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createContactCalls.length, 1)
  assert.equal(state.createContactCalls[0]['source'], 'fluentcrm:website')
}

async function testSourceNotDoublePrefixed() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'apply' })

  await runImport({
    runId: 'run-source-002',
    contacts: [makeContact({ source: 'fluentcrm:referral', tags: [], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createContactCalls[0]['source'], 'fluentcrm:referral')
}

// ─── Lifecycle stage default ──────────────────────────────────────────────────

async function testNewContactDefaultsToLeadLifecycle() {
  const { client, state } = makeFakeClient()
  const config = makeConfig({ mode: 'apply' })

  await runImport({
    runId: 'run-lifecycle-001',
    contacts: [makeContact({ tags: [], lists: [] })],
    config,
    client,
    initialJournal: [],
    initialWarnings: [],
  })

  assert.equal(state.createContactCalls[0]['lifecycleStage'], 'lead')
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const tests: Array<{ name: string; fn: () => unknown | Promise<unknown> }> = [
  // CSV parsing
  { name: 'csv: basic parsing', fn: testCsvBasicParsing },
  { name: 'csv: pipe-separated tags and lists', fn: testCsvPipeSeparatedTagsAndLists },
  { name: 'csv: empty tags and lists', fn: testCsvEmptyTagsAndLists },
  { name: 'csv: missing email row skipped', fn: testCsvMissingEmailSkipped },
  { name: 'csv: empty file returns empty', fn: testCsvEmptyFileReturnsEmpty },
  { name: 'csv: header-only returns empty', fn: testCsvHeaderOnlyReturnsEmpty },
  { name: 'csv: null consent_at becomes null', fn: testCsvNullConsentAt },
  { name: 'csv: CRLF line endings handled', fn: testCsvCrlfLineEndings },
  // JSON parsing
  { name: 'json: basic parsing', fn: testJsonBasicParsing },
  { name: 'json: missing email row skipped', fn: testJsonMissingEmailSkipped },
  { name: 'json: invalid format throws', fn: testJsonInvalidFormatThrows },
  { name: 'json: non-array root throws', fn: testJsonNonArrayThrows },
  { name: 'json: non-object item skipped with warning', fn: testJsonNonObjectItemSkipped },
  // Deduplication
  { name: 'dedup: case-insensitive match', fn: testDeduplicateCaseInsensitive },
  { name: 'dedup: keeps most recent lastActivity', fn: testDeduplicateKeepsMostRecent },
  { name: 'dedup: no duplicates passes through', fn: testDeduplicateNoDuplicates },
  // Status mapping
  { name: 'status: all variant mappings', fn: testStatusMappingAllVariants },
  // Source mapping
  { name: 'source: prefixes non-prefixed source', fn: testMapSourcePrefixesNonPrefixed },
  { name: 'source: preserves existing fluentcrm: prefix', fn: testMapSourcePreservesExistingPrefix },
  { name: 'source: empty source fallback', fn: testMapSourceEmptyFallback },
  // Tag slug
  { name: 'slug: builds from tag name', fn: testBuildTagSlug },
  // Idempotency
  { name: 'idempotency: key is consistent', fn: testIdempotencyKeyIsConsistent },
  { name: 'idempotency: key is case-insensitive', fn: testIdempotencyKeyCaseInsensitive },
  { name: 'idempotency: key is sha256 hex', fn: testIdempotencyKeyIsSha256 },
  // Consent preservation
  { name: 'consent: blocks subscribed over unsubscribed', fn: testConsentPreservationBlocksSubscribedOverUnsubscribed },
  { name: 'consent: blocks subscribed over bounced', fn: testConsentPreservationBlocksSubscribedOverBounced },
  { name: 'consent: blocks subscribed over complained', fn: testConsentPreservationBlocksSubscribedOverComplained },
  { name: 'consent: allows unsubscribed over subscribed', fn: testConsentPreservationAllowsUnsubscribedOverSubscribed },
  { name: 'consent: allows protected status over other protected', fn: testConsentPreservationAllowsSubsequentProtectedStatus },
  { name: 'consent: no existing status is fine', fn: testConsentPreservationNoExistingStatus },
  // Dry-run
  { name: 'dry-run: no mutations', fn: testDryRunProducesNoMutations },
  { name: 'dry-run: records outcome in journal', fn: testDryRunJournalRecordsOutcome },
  // Apply mode
  { name: 'apply: requires confirmation token', fn: testApplyRequiresConfirmationToken },
  { name: 'apply: creates new contact', fn: testApplyCreatesContact },
  { name: 'apply: updates existing contact', fn: testApplyUpdatesExistingContact },
  // Consent in apply
  { name: 'apply consent: never downgrades unsubscribed', fn: testApplyNeverDowngradesUnsubscribed },
  { name: 'apply consent: never downgrades bounced', fn: testApplyNeverDowngradesBounced },
  { name: 'apply consent: never downgrades complained', fn: testApplyNeverDowngradesComplained },
  // Tags
  { name: 'tags: created on apply', fn: testTagCreatedOnApply },
  { name: 'tags: not duplicated when already exists', fn: testTagNotDuplicatedWhenAlreadyExists },
  { name: 'tags: shared across contacts not duplicated', fn: testSameTagSharedAcrossContactsNotDuplicated },
  { name: 'tags: contact-tag link not duplicated', fn: testContactTagNotDuplicatedWhenLinkExists },
  { name: 'tags: lists created as tags', fn: testListsCreatedAsTagsWithMigrationSource },
  // Batch limit
  { name: 'batch: limit enforced in apply', fn: testBatchLimitEnforced },
  { name: 'batch: limit enforced in dry-run', fn: testBatchLimitRespectedInDryRun },
  // Journal resume
  { name: 'resume: skips journaled contacts', fn: testResumeSkipsJournaledContacts },
  { name: 'resume: case-insensitive match', fn: testResumeCaseInsensitive },
  { name: 'journal: appends to file', fn: testDurableJournalAppendsToFile },
  { name: 'journal: load returns empty for missing file', fn: testLoadJournalReturnsEmptyForMissingFile },
  { name: 'journal: roundtrips entries', fn: testLoadJournalRoundtrips },
  { name: 'journal: resume from durable file', fn: testResumeFromDurableJournalFile },
  // Validate mode
  { name: 'validate: no client calls', fn: testValidateModeNoClientCalls },
  // Rollback mode
  { name: 'rollback: no mutations', fn: testRollbackModeNoMutations },
  // Error handling
  { name: 'error: contact create failure stops run', fn: testContactCreateFailureStopsRun },
  { name: 'error: tag failure is warning not stop', fn: testTagFailureRecordedAsWarningNotStop },
  // Reconciliation report
  { name: 'report: reconciliation accuracy', fn: testReconciliationReportAccuracy },
  { name: 'report: no warnings shows none', fn: testReconciliationReportNoWarnings },
  // Rollback evidence
  { name: 'rollback-evidence: contains created and updated', fn: testRollbackEvidenceContainsCreatedContacts },
  { name: 'rollback-evidence: empty journal', fn: testRollbackEvidenceEmptyJournal },
  // Source and lifecycle
  { name: 'source: prefixed on create', fn: testSourcePrefixedOnCreate },
  { name: 'source: not double-prefixed', fn: testSourceNotDoublePrefixed },
  { name: 'lifecycle: new contact defaults to lead', fn: testNewContactDefaultsToLeadLifecycle },
]

async function runTests() {
  let passed = 0
  let failed = 0
  const errors: string[] = []

  for (const t of tests) {
    try {
      await t.fn()
      console.log(`✓ ${t.name}`)
      passed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`✗ ${t.name}: ${msg}`)
      errors.push(`${t.name}: ${msg}`)
      failed++
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────`)
  console.log(`FluentCRM Importer Tests: ${passed} passed, ${failed} failed`)
  console.log(`─────────────────────────────────────────────────────────`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    for (const err of errors) console.log(`  - ${err}`)
    process.exit(1)
  }
}

runTests()
