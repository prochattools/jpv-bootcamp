#!/usr/bin/env node

import crypto from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('pg')
const {
  applyConsolidationPlanToSnapshot,
  buildConsolidationPlan,
  consolidationPlanFingerprint,
  planOperationCount,
  sourceDependencyCounts,
  totalSourceDependencyCount,
} = await import(process.env.INFO_FORUM_PLANNER_PATH?.trim() || '/app/compiled/infoForumConsolidationPlan.js')

export const INFO_FORUM_MIGRATION = 'info-forum-to-forum'
export const PRODUCTION_CONFIRMATION = 'apply-info-forum-to-forum-production'
export const REHEARSAL_CONFIRMATION = 'rehearse-info-forum-to-forum-on-restored-production-backup'
export const EXPECTED_PRODUCTION = Object.freeze({
  deploymentEnv: 'production',
  origin: 'https://jpvbootcamp.com',
  applicationId: 'I_2Vukga3cc3ZhaG-mUzU',
  applicationName: 'clients-jpv-bootcamp-app-tp9xrk',
  host: '10.0.2.4',
  port: '5433',
  database: 'jpvbootcamp',
  schema: 'jpvbootcamp',
  databaseRole: 'jpvbootcamp_production_app',
})

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const FULL_SHA = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SOURCE_SLUG = 'info-forum'
const SOURCE_SLUG_ALIASES = Object.freeze(['info-forum', 'start-here'])
const SOURCE_NAME = 'Info Forum'
const DESTINATION_SLUG = 'forum'
const DESTINATION_NAME = 'Forum'

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new Error('schema_identifier_invalid')
  return `"${value}"`
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

function safeReference(value, name) {
  if (!SAFE_REFERENCE.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function assertSha(value, name) {
  if (!FULL_SHA.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function assertSha256(value, name) {
  if (!SHA256.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function parseDatabaseUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('database_url_invalid')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error('database_url_invalid')
  const database = parsed.pathname.replace(/^\//, '')
  const schemas = parsed.searchParams.getAll('schema')
  if (!parsed.hostname || !database || schemas.length !== 1 || schemas[0] !== EXPECTED_PRODUCTION.schema) {
    throw new Error('database_url_invalid')
  }
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database,
    schema: schemas[0],
    role: decodeURIComponent(parsed.username || ''),
  }
}

function validateTarget() {
  const target = process.env.INFO_FORUM_MIGRATION_TARGET
  const deploymentEnv = process.env.DEPLOYMENT_ENV
  if (target === 'production') {
    if (deploymentEnv !== EXPECTED_PRODUCTION.deploymentEnv) throw new Error('deployment_environment_mismatch')
    const configured = parseDatabaseUrl(required('DATABASE_URL'))
    const planViaTailnet = process.env.INFO_FORUM_MIGRATION_MODE === 'plan' && process.env.INFO_FORUM_READONLY_TAILNET === 'true'
    const allowedHosts = planViaTailnet ? [EXPECTED_PRODUCTION.host, '100.71.31.88'] : [EXPECTED_PRODUCTION.host]
    if (
      !allowedHosts.includes(configured.host) ||
      configured.port !== EXPECTED_PRODUCTION.port ||
      configured.database !== EXPECTED_PRODUCTION.database ||
      configured.schema !== EXPECTED_PRODUCTION.schema ||
      configured.role !== EXPECTED_PRODUCTION.databaseRole
    ) throw new Error('production_database_boundary_mismatch')
    if (process.env.TARGET_ORIGIN !== EXPECTED_PRODUCTION.origin) throw new Error('target_origin_mismatch')
    if (process.env.DOKPLOY_APPLICATION_ID !== EXPECTED_PRODUCTION.applicationId) throw new Error('dokploy_application_mismatch')
    if (process.env.DOKPLOY_APPLICATION_NAME !== EXPECTED_PRODUCTION.applicationName) throw new Error('dokploy_application_mismatch')
    return { target, configured }
  }
  if (target === 'rehearsal') {
    if (deploymentEnv !== 'rehearsal') throw new Error('rehearsal_environment_mismatch')
    if (process.env.INFO_FORUM_REHEARSAL_CONFIRMATION !== REHEARSAL_CONFIRMATION) throw new Error('rehearsal_confirmation_invalid')
    safeReference(required('INFO_FORUM_REHEARSAL_EVIDENCE_ID'), 'rehearsal_evidence_id')
    const configured = parseDatabaseUrl(required('DATABASE_URL'))
    if (configured.database === EXPECTED_PRODUCTION.database) throw new Error('live_database_rejected_for_rehearsal')
    return { target, configured }
  }
  throw new Error('migration_target_invalid')
}

function validateApplyAuthorization(target, sourceId, sourceSlug, destinationId, fingerprint) {
  if (target === 'rehearsal') {
    if (process.env.INFO_FORUM_MIGRATION_MODE !== 'apply') throw new Error('rehearsal_apply_mode_required')
    return
  }
  if (process.env.INFO_FORUM_MIGRATION_MODE !== 'apply') throw new Error('production_apply_mode_required')
  if (process.env.INFO_FORUM_PRODUCTION_CONFIRMATION !== PRODUCTION_CONFIRMATION) throw new Error('production_confirmation_invalid')
  if (process.env.INFO_FORUM_LIVE_DRY_RUN_PASSED !== 'true') throw new Error('live_dry_run_attestation_required')
  assertSha(required('INFO_FORUM_MAIN_SHA'), 'main_sha')
  if (process.env.INFO_FORUM_MAIN_SHA !== process.env.INFO_FORUM_EXPECTED_RELEASE_SHA) throw new Error('release_sha_attestation_mismatch')
  if (process.env.IMAGE_TAG !== process.env.INFO_FORUM_MAIN_SHA || process.env.COMMIT_SHA !== process.env.INFO_FORUM_MAIN_SHA) {
    throw new Error('runtime_release_sha_mismatch')
  }
  safeReference(required('INFO_FORUM_BACKUP_EVIDENCE_ID'), 'backup_evidence_id')
  assertSha256(required('INFO_FORUM_BACKUP_SHA256'), 'backup_sha256')
  safeReference(required('INFO_FORUM_REHEARSAL_EVIDENCE_ID'), 'rehearsal_evidence_id')
  safeReference(required('INFO_FORUM_OPERATION_ID'), 'operation_id')
  if (sourceId !== required('INFO_FORUM_EXPECTED_SOURCE_ID')) throw new Error('source_id_attestation_mismatch')
  if (sourceSlug !== required('INFO_FORUM_EXPECTED_SOURCE_SLUG')) throw new Error('source_slug_attestation_mismatch')
  if (destinationId !== required('INFO_FORUM_EXPECTED_DESTINATION_ID')) throw new Error('destination_id_attestation_mismatch')
  if (fingerprint !== assertSha256(required('INFO_FORUM_EXPECTED_PLAN_FINGERPRINT'), 'plan_fingerprint')) {
    throw new Error('plan_fingerprint_mismatch')
  }
}

function countFrom(result) {
  return Number(result.rows[0]?.count ?? 0)
}

function relationRow(row, field = 'space_id') {
  return { id: String(row.id), space: String(row[field]) }
}

async function findSpaces(client, schema, sourceId, destinationId) {
  const ident = quoteIdentifier(schema)
  const result = await client.query(
    `SELECT "id", "slug", "name", "status" FROM ${ident}."payload_spaces" WHERE "id" IN ($1, $2) ORDER BY "id" ASC`,
    [sourceId, destinationId],
  )
  return result.rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    status: String(row.status ?? ''),
  }))
}

async function findSpaceByIdentity(client, schema, id, allowedSlugs, name, label) {
  const ident = quoteIdentifier(schema)
  const params = id ? [id] : [allowedSlugs]
  const where = id ? '"id" = $1' : '"slug" = ANY($1::text[])'
  const result = await client.query(
    `SELECT "id", "slug", "name", "status" FROM ${ident}."payload_spaces" WHERE ${where} ORDER BY "id" ASC`,
    params,
  )
  if (result.rows.length !== 1) throw new Error(`${label}_space_identity_not_unique`)
  const row = result.rows[0]
  if (!allowedSlugs.includes(String(row.slug)) || String(row.name).trim() !== name) throw new Error(`${label}_space_identity_mismatch`)
  return { id: String(row.id), slug: String(row.slug), name: String(row.name), status: String(row.status ?? '') }
}

async function buildSnapshot(client, schema, sourceId, destinationId) {
  const ident = quoteIdentifier(schema)
  // A pg Client does not support overlapping queries on one connection. Keep
  // this inventory sequential so the snapshot is warning-free both outside
  // and inside the guarded apply transaction.
  const spaces = await findSpaces(client, schema, sourceId, destinationId)
  const posts = await client.query(`SELECT "id", "space_id" FROM ${ident}."payload_space_posts" WHERE "space_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const memberships = await client.query(`SELECT "id", "member_id", "space_id" FROM ${ident}."payload_space_memberships" WHERE "space_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const files = await client.query(`SELECT "id", "space_id" FROM ${ident}."payload_space_files" WHERE "space_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const threads = await client.query(`SELECT "id", "space_id" FROM ${ident}."payload_chat_threads" WHERE "space_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const rooms = await client.query(`SELECT "id", "space_id" FROM ${ident}."live_sessions" WHERE "space_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const policies = await client.query(`SELECT "id", "resource_type", "resource_id" FROM ${ident}."payload_access_policies" WHERE "resource_type" = 'space' AND "resource_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const grants = await client.query(`SELECT "id", "resource_type", "resource_id" FROM ${ident}."payload_access_grants" WHERE "resource_type" = 'space' AND "resource_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const entitlementEvents = await client.query(`SELECT "id", "resource_type", "resource_id" FROM ${ident}."payload_entitlement_events" WHERE "resource_type" = 'space' AND "resource_id" IN ($1, $2) ORDER BY "id" ASC`, [sourceId, destinationId])
  const notifications = await client.query(`SELECT "id", "href" FROM ${ident}."payload_member_notifications" WHERE "href" IS NOT NULL ORDER BY "id" ASC`)
  const comments = await client.query(`SELECT comments."id", posts."space_id" FROM ${ident}."payload_space_comments" comments JOIN ${ident}."payload_space_posts" posts ON posts."id" = comments."post_id" WHERE posts."space_id" IN ($1, $2) ORDER BY comments."id" ASC`, [sourceId, destinationId])
  const legacyReactions = await client.query(`SELECT reactions."id", COALESCE(target_posts."space_id", comment_posts."space_id") AS "space_id" FROM ${ident}."payload_space_reactions" reactions LEFT JOIN ${ident}."payload_space_posts" target_posts ON target_posts."id" = reactions."target_post_id" LEFT JOIN ${ident}."payload_space_comments" comments ON comments."id" = reactions."target_comment_id" LEFT JOIN ${ident}."payload_space_posts" comment_posts ON comment_posts."id" = comments."post_id" WHERE target_posts."space_id" IN ($1, $2) OR comment_posts."space_id" IN ($1, $2) ORDER BY reactions."id" ASC`, [sourceId, destinationId])
  const engagementReactions = await client.query(`SELECT reactions."id", COALESCE(target_posts."space_id", comment_posts."space_id") AS "space_id" FROM ${ident}."payload_engagement_reactions" reactions LEFT JOIN ${ident}."payload_space_posts" target_posts ON target_posts."id" = reactions."target_post_id" LEFT JOIN ${ident}."payload_space_comments" comments ON comments."id" = reactions."target_space_comment_id" LEFT JOIN ${ident}."payload_space_posts" comment_posts ON comment_posts."id" = comments."post_id" WHERE target_posts."space_id" IN ($1, $2) OR comment_posts."space_id" IN ($1, $2) ORDER BY reactions."id" ASC`, [sourceId, destinationId])
  const chatMessages = await client.query(`SELECT messages."id", threads."space_id" FROM ${ident}."payload_chat_messages" messages JOIN ${ident}."payload_chat_threads" threads ON threads."id" = messages."thread_id" WHERE threads."space_id" IN ($1, $2) ORDER BY messages."id" ASC`, [sourceId, destinationId])
  const sourceCommentCount = comments.rows.filter((row) => String(row.space_id) === sourceId).length
  const sourceLegacyReactionCount = legacyReactions.rows.filter((row) => String(row.space_id) === sourceId).length
  const sourceEngagementReactionCount = engagementReactions.rows.filter((row) => String(row.space_id) === sourceId).length
  const sourceChatMessageCount = chatMessages.rows.filter((row) => String(row.space_id) === sourceId).length
  return {
    spaces,
    posts: posts.rows.map((row) => relationRow(row)),
    memberships: memberships.rows.map((row) => ({ id: String(row.id), member: String(row.member_id ?? ''), space: String(row.space_id) })),
    files: files.rows.map((row) => relationRow(row)),
    threads: threads.rows.map((row) => relationRow(row)),
    rooms: rooms.rows.map((row) => relationRow(row)),
    policies: policies.rows.map((row) => ({ id: String(row.id), resourceType: String(row.resource_type), resourceId: String(row.resource_id) })),
    grants: grants.rows.map((row) => ({ id: String(row.id), resourceType: String(row.resource_type), resourceId: String(row.resource_id) })),
    entitlementEvents: entitlementEvents.rows.map((row) => ({ id: String(row.id), resourceType: String(row.resource_type), resourceId: String(row.resource_id) })),
    notifications: notifications.rows.map((row) => ({ id: String(row.id), href: String(row.href ?? '') })).filter((row) => row.href),
    comments: sourceCommentCount,
    reactions: sourceLegacyReactionCount + sourceEngagementReactionCount,
    chatMessages: sourceChatMessageCount,
    relationshipIds: {
      comments: comments.rows.map((row) => String(row.id)),
      reactions: [
        ...legacyReactions.rows.map((row) => `legacy:${String(row.id)}`),
        ...engagementReactions.rows.map((row) => `engagement:${String(row.id)}`),
      ],
      chatMessages: chatMessages.rows.map((row) => String(row.id)),
    },
  }
}

function inventory(snapshot, sourceId, destinationId, sourceRouteSlugs = [SOURCE_SLUG]) {
  const oldPrefixes = sourceRouteSlugs.map((slug) => `/portal/community/${slug}`)
  return {
    spaces: snapshot.spaces.filter((space) => space.id === sourceId || space.id === destinationId),
    sourcePosts: snapshot.posts.filter((item) => item.space === sourceId).length,
    sourceComments: snapshot.comments,
    sourceReactions: snapshot.reactions,
    sourceMemberships: snapshot.memberships.filter((item) => item.space === sourceId).length,
    destinationMemberships: snapshot.memberships.filter((item) => item.space === destinationId).length,
    sourceFiles: snapshot.files.filter((item) => item.space === sourceId).length,
    sourceChatThreads: snapshot.threads.filter((item) => item.space === sourceId).length,
    sourceChatMessages: snapshot.chatMessages,
    sourceRooms: snapshot.rooms.filter((item) => item.space === sourceId).length,
    sourceAccessPolicies: snapshot.policies.filter((item) => item.resourceType === 'space' && item.resourceId === sourceId).length,
    sourceAccessGrants: snapshot.grants.filter((item) => item.resourceType === 'space' && item.resourceId === sourceId).length,
    sourceEntitlementEvents: snapshot.entitlementEvents.filter((item) => item.resourceType === 'space' && item.resourceId === sourceId).length,
    notificationDeepLinks: snapshot.notifications.filter((item) => oldPrefixes.some((prefix) => item.href === prefix || item.href.startsWith(`${prefix}/`))).length,
  }
}

function safePlanSummary(plan, snapshot, sourceId, destinationId, sourceSlug, sourceRouteSlugs) {
  const simulated = applyConsolidationPlanToSnapshot(snapshot, plan)
  const remaining = sourceDependencyCounts(simulated, sourceId, sourceSlug, sourceRouteSlugs)
  const directMovesByCollection = plan.moves.reduce((counts, operation) => {
    counts[operation.collection] = (counts[operation.collection] ?? 0) + 1
    return counts
  }, {})
  return {
    totalOperations: planOperationCount(plan),
    directMovesByCollection,
    membershipMoves: plan.membershipMoves.length,
    membershipDeduplications: plan.membershipDeletes.length,
    notificationRewrites: plan.notificationRewrites.length,
    conflicts: plan.conflicts,
    expectedDestructiveDeletes: plan.membershipDeletes.length,
    unexpectedDestructiveDeletes: 0,
    remainingDependenciesAfterSimulation: remaining,
    preservedRelationships: plan.preservedRelationshipCounts,
  }
}

async function resolveTarget(client, schema) {
  const source = await findSpaceByIdentity(client, schema, process.env.INFO_FORUM_SOURCE_ID?.trim(), SOURCE_SLUG_ALIASES, SOURCE_NAME, 'source')
  const destination = await findSpaceByIdentity(client, schema, process.env.INFO_FORUM_DESTINATION_ID?.trim(), [DESTINATION_SLUG], DESTINATION_NAME, 'destination')
  if (source.id === destination.id) throw new Error('source_and_destination_must_differ')
  return { source, destination }
}

async function verifyPreconditions(snapshot, plan, sourceId, destinationId, sourceSlug, sourceRouteSlugs) {
  if (plan.conflicts.length > 0) throw new Error(`migration_conflicts:${plan.conflicts.join(',')}`)
  const remaining = sourceDependencyCounts(snapshot, sourceId, sourceSlug, sourceRouteSlugs)
  if (totalSourceDependencyCount(remaining) === 0) throw new Error('no_material_migration_work')
  if (snapshot.spaces.find((space) => space.id === destinationId)?.status !== 'published') throw new Error('destination_space_not_active')
}

function verifyDirectMoveResults(before, after, plan, sourceId, destinationId) {
  const references = {
    payload_space_posts: 'posts',
    payload_space_files: 'files',
    payload_chat_threads: 'threads',
    live_sessions: 'rooms',
    payload_access_policies: 'policies',
    payload_access_grants: 'grants',
    payload_entitlement_events: 'entitlementEvents',
  }
  for (const [collection, field] of Object.entries(references)) {
    const planned = plan.moves.filter((operation) => operation.collection === collection).length
    const beforeItems = before[field]
    const afterItems = after[field]
    const beforeSource = beforeItems.filter((item) => ('space' in item ? item.space : item.resourceId) === sourceId).length
    const beforeDestination = beforeItems.filter((item) => ('space' in item ? item.space : item.resourceId) === destinationId).length
    const afterSource = afterItems.filter((item) => ('space' in item ? item.space : item.resourceId) === sourceId).length
    const afterDestination = afterItems.filter((item) => ('space' in item ? item.space : item.resourceId) === destinationId).length
    if (beforeSource !== planned || afterSource !== 0 || afterDestination !== beforeDestination + planned) {
      throw new Error(`direct_move_integrity_failed:${collection}`)
    }
  }
  const beforeSourceMemberships = before.memberships.filter((item) => item.space === sourceId).length
  const beforeDestinationMemberships = before.memberships.filter((item) => item.space === destinationId).length
  const deletedDestinationMemberships = plan.membershipDeletes.filter((operation) => before.memberships.find((item) => item.id === operation.id)?.space === destinationId).length
  const expectedDestinationMemberships = beforeDestinationMemberships + plan.membershipMoves.length - deletedDestinationMemberships
  const afterSourceMemberships = after.memberships.filter((item) => item.space === sourceId).length
  const afterDestinationMemberships = after.memberships.filter((item) => item.space === destinationId).length
  if (beforeSourceMemberships !== plan.membershipMoves.length + plan.membershipDeletes.filter((operation) => before.memberships.find((item) => item.id === operation.id)?.space === sourceId).length || afterSourceMemberships !== 0 || afterDestinationMemberships !== expectedDestinationMemberships) {
    throw new Error('membership_integrity_failed')
  }
}

function sameStringSet(left = [], right = []) {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

async function updateExactlyOne(client, sql, params, code) {
  const result = await client.query(sql, params)
  if (Number(result.rowCount) !== 1) throw new Error(code)
}

async function applyPlanInTransaction(client, schema, plan, sourceId, sourceSlug, destinationId) {
  const ident = quoteIdentifier(schema)
  for (const operation of plan.moves) {
    const table = {
      payload_space_posts: 'payload_space_posts',
      payload_space_files: 'payload_space_files',
      payload_chat_threads: 'payload_chat_threads',
      live_sessions: 'live_sessions',
    }[operation.collection]
    if (table) {
      const column = 'space_id'
      await updateExactlyOne(client, `UPDATE ${ident}."${table}" SET "${column}" = $1, "updated_at" = NOW() WHERE "id" = $2 AND "${column}" = $3`, [destinationId, operation.id, sourceId], `direct_move_failed:${operation.collection}:${operation.id}`)
      continue
    }
    if (operation.collection === 'payload_access_policies' || operation.collection === 'payload_access_grants' || operation.collection === 'payload_entitlement_events') {
      await updateExactlyOne(client, `UPDATE ${ident}."${operation.collection}" SET "resource_id" = $1, "updated_at" = NOW() WHERE "id" = $2 AND "resource_type" = 'space' AND "resource_id" = $3`, [destinationId, operation.id, sourceId], `resource_move_failed:${operation.collection}:${operation.id}`)
      continue
    }
    throw new Error(`unsupported_move_collection:${operation.collection}`)
  }
  for (const operation of plan.membershipMoves) {
    await updateExactlyOne(client, `UPDATE ${ident}."payload_space_memberships" SET "space_id" = $1, "updated_at" = NOW() WHERE "id" = $2 AND "space_id" = $3`, [destinationId, operation.id, sourceId], `membership_move_failed:${operation.id}`)
  }
  for (const operation of plan.membershipDeletes) {
    await updateExactlyOne(client, `DELETE FROM ${ident}."payload_space_memberships" WHERE "id" = $1 AND "space_id" IN ($2, $3)`, [operation.id, sourceId, destinationId], `membership_delete_failed:${operation.id}`)
  }
  for (const operation of plan.notificationRewrites) {
    await updateExactlyOne(client, `UPDATE ${ident}."payload_member_notifications" SET "href" = $1, "updated_at" = NOW() WHERE "id" = $2 AND "href" = $3`, [operation.to, operation.id, operation.from], `notification_rewrite_failed:${operation.id}`)
  }
  await updateExactlyOne(client, `UPDATE ${ident}."payload_spaces" SET "status" = 'archived', "updated_at" = NOW() WHERE "id" = $1 AND "slug" = $2 AND "name" = $3 AND "status" <> 'archived'`, [sourceId, sourceSlug, SOURCE_NAME], 'source_archive_failed')
}

async function readOnlySnapshot(client, schema, sourceId, destinationId) {
  await client.query('BEGIN TRANSACTION READ ONLY')
  try {
    await client.query("SET LOCAL statement_timeout = '30000ms'")
    return await buildSnapshot(client, schema, sourceId, destinationId)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
  }
}

function outputPlan(target, source, destination, snapshot, plan, sourceRouteSlugs) {
  const fingerprint = consolidationPlanFingerprint(snapshot, plan, source.id, destination.id)
  return {
    version: 1,
    ok: plan.conflicts.length === 0,
    mode: 'dry-run',
    target,
    migration: INFO_FORUM_MIGRATION,
    source: { id: source.id, slug: source.slug, name: source.name },
    destination: { id: destination.id, slug: destination.slug, name: destination.name },
    inventory: inventory(snapshot, source.id, destination.id, sourceRouteSlugs),
    plan: safePlanSummary(plan, snapshot, source.id, destination.id, source.slug, sourceRouteSlugs),
    planFingerprint: fingerprint,
    unresolvedReferences: plan.conflicts.length,
    ambiguousReferences: plan.conflicts.filter((item) => item.includes('identity')).length,
    preservedRelationships: plan.preservedRelationshipCounts,
  }
}

async function runPlan(client, schema, target) {
  const { source, destination } = await resolveTarget(client, schema)
  const snapshot = await readOnlySnapshot(client, schema, source.id, destination.id)
  const sourceRouteSlugs = [...new Set([source.slug, ...SOURCE_SLUG_ALIASES])]
  const plan = buildConsolidationPlan(snapshot, source.id, destination.id, source.slug, DESTINATION_SLUG, sourceRouteSlugs)
  const result = outputPlan(target, source, destination, snapshot, plan, sourceRouteSlugs)
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (!result.ok) process.exitCode = 1
}

async function runApply(client, schema, target) {
  const { source, destination } = await resolveTarget(client, schema)
  const sourceId = source.id
  const destinationId = destination.id
  await client.query('BEGIN')
  let committed = false
  try {
    await client.query("SET LOCAL statement_timeout = '60000ms'")
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [INFO_FORUM_MIGRATION])
    const before = await buildSnapshot(client, schema, sourceId, destinationId)
    const sourceRouteSlugs = [...new Set([source.slug, ...SOURCE_SLUG_ALIASES])]
    const plan = buildConsolidationPlan(before, sourceId, destinationId, source.slug, DESTINATION_SLUG, sourceRouteSlugs)
    const fingerprint = consolidationPlanFingerprint(before, plan, sourceId, destinationId)
    validateApplyAuthorization(target, sourceId, source.slug, destinationId, fingerprint)
    await verifyPreconditions(before, plan, sourceId, destinationId, source.slug, sourceRouteSlugs)
    await applyPlanInTransaction(client, schema, plan, sourceId, source.slug, destinationId)
    const after = await buildSnapshot(client, schema, sourceId, destinationId)
    verifyDirectMoveResults(before, after, plan, sourceId, destinationId)
    const remaining = sourceDependencyCounts(after, sourceId, source.slug, sourceRouteSlugs)
    if (totalSourceDependencyCount(remaining) > 0) throw new Error('source_dependencies_remain')
    const beforeRelationships = before.relationshipIds
    const afterRelationships = after.relationshipIds
    if (!beforeRelationships || !afterRelationships || !sameStringSet(beforeRelationships.comments, afterRelationships.comments) || !sameStringSet(beforeRelationships.reactions, afterRelationships.reactions) || !sameStringSet(beforeRelationships.chatMessages, afterRelationships.chatMessages)) {
      throw new Error('indirect_relationships_changed')
    }
    const afterSource = after.spaces.find((space) => space.id === sourceId)
    const afterDestination = after.spaces.find((space) => space.id === destinationId)
    if (afterSource?.status !== 'archived') throw new Error('source_not_archived')
    if (afterDestination?.status !== 'published') throw new Error('destination_not_active_after_apply')
    await client.query('COMMIT')
    committed = true
    const verified = await readOnlySnapshot(client, schema, sourceId, destinationId)
    const verifiedRemaining = sourceDependencyCounts(verified, sourceId, source.slug, sourceRouteSlugs)
    if (totalSourceDependencyCount(verifiedRemaining) > 0) throw new Error('post_commit_source_dependencies_remain')
    const rerunPlan = buildConsolidationPlan(verified, sourceId, destinationId, source.slug, DESTINATION_SLUG, sourceRouteSlugs)
    if (planOperationCount(rerunPlan) !== 0) throw new Error('rerun_not_idempotent')
    process.stdout.write(`${JSON.stringify({ version: 1, ok: true, mode: 'apply', target, migration: INFO_FORUM_MIGRATION, source: { id: sourceId, slug: source.slug, name: source.name }, destination: { id: destinationId, slug: destination.slug, name: destination.name }, before: inventory(before, sourceId, destinationId, sourceRouteSlugs), after: inventory(verified, sourceId, destinationId, sourceRouteSlugs), planFingerprint: fingerprint, remainingDependencies: verifiedRemaining, rerunIsIdempotent: true, indirectRelationshipsPreserved: true })}\n`)
  } catch (error) {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined)
    process.stdout.write(`${JSON.stringify({ version: 1, ok: false, mode: 'apply', target, migration: INFO_FORUM_MIGRATION, resultCode: committed ? 'uncertain' : 'blocked', blockers: [error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_:-]/g, '_') : 'unknown_error'] })}\n`)
    process.exitCode = 1
  }
}

async function main() {
  let client
  try {
    const mode = process.env.INFO_FORUM_MIGRATION_MODE?.trim()
    if (!['plan', 'apply'].includes(mode)) throw new Error('migration_mode_invalid')
    const { target } = validateTarget()
    const database = parseDatabaseUrl(required('DATABASE_URL'))
    client = new Client({ connectionString: required('DATABASE_URL') })
    await client.connect()
    const schema = database.schema
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}`)
    if (mode === 'plan') await runPlan(client, schema, target)
    else await runApply(client, schema, target)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ version: 1, ok: false, migration: INFO_FORUM_MIGRATION, resultCode: 'blocked', blockers: [error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_:-]/g, '_') : 'unknown_error'] })}\n`)
    process.exitCode = 1
  } finally {
    await client?.end().catch(() => undefined)
  }
}

if (process.env.INFO_FORUM_RUNNER_TEST !== '1') await main()

export { parseDatabaseUrl, validateTarget }
