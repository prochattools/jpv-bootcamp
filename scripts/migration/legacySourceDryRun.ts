import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export type SqlScalar = string | null
export type SqlRow = Record<string, SqlScalar>

export interface ParsedSqlDump {
  tables: Map<string, SqlRow[]>
}

export interface WordPressUserSource {
  id: string
  email: string
  displayName: string
  role: 'subscriber' | 'administrator' | 'other'
}

export interface FluentCrmContactSource {
  id: string
  userId: string | null
  email: string
  firstName: string | null
  lastName: string | null
  status: string
}

export interface CommunitySpaceSource {
  id: string
  createdBy: string | null
  parentId: string | null
  title: string
  targetTitle: string
  slug: string
  description: string | null
  type: string
  privacy: string
  status: string
  serial: number
  settings: string | null
  migrate: boolean
  exclusionReason?: string
}

export interface CommunityPostSource {
  id: string
  userId: string | null
  parentId: string | null
  spaceId: string | null
  title: string | null
  slug: string | null
  message: string | null
  messageRendered: string | null
  type: string
  contentType: string
  privacy: string
  status: string
  featuredImage: string | null
  meta: string | null
  isSticky: boolean
  priority: number
  createdAt: string | null
}

export interface CommunityCommentSource {
  id: string
  userId: string | null
  postId: string | null
  parentId: string | null
  message: string | null
  messageRendered: string | null
  meta: string | null
  type: string
  contentType: string
  status: string
  isSticky: boolean
  createdAt: string | null
}

export interface CommunityReactionSource {
  id: string
  userId: string | null
  objectId: string | null
  parentId: string | null
  objectType: string
  type: string
  createdAt: string | null
}

export interface CommunitySpaceMembershipSource {
  id: string
  spaceId: string | null
  userId: string
  status: string
  role: string
}

export interface CommunityMediaSource {
  id: string
  objectSource: string
  mediaKey: string
  userId: string | null
  feedId: string | null
  subObjectId: string | null
  mediaType: string | null
  driver: string
  mediaPath: string | null
  mediaUrl: string | null
}

export interface CommunityProfileSource {
  id: string
  userId: string
  displayName: string
  avatar: string | null
  shortDescription: string | null
  shortDescriptionRendered: string | null
  website: string | null
  headline: string | null
  coverPhoto: string | null
  socialLinks: {
    instagram: string | null
    twitter: string | null
    linkedin: string | null
    facebook: string | null
    youtube: string | null
  }
  status: string
  metaRaw: string | null
}

export interface PortalSettingsSource {
  fluentCommunitySettingsRaw: string | null
  authSettingsRaw: string | null
  customizationSettingsRaw: string | null
  welcomeBannerSettingsRaw: string | null
  snippetsSettingsRaw: string | null
}

export interface CommunityActivitySource {
  id: string
  userId: string | null
  feedId: string | null
  spaceId: string | null
  relatedId: string | null
  actionName: string
  createdAt: string | null
}

export interface LegacySqlSnapshot {
  wordpressUsers: WordPressUserSource[]
  fluentCrmContacts: FluentCrmContactSource[]
  communityProfiles: CommunityProfileSource[]
  portalSettingsSource: PortalSettingsSource
  spaces: CommunitySpaceSource[]
  posts: CommunityPostSource[]
  comments: CommunityCommentSource[]
  reactions: CommunityReactionSource[]
  spaceMemberships: CommunitySpaceMembershipSource[]
  communityMedia: CommunityMediaSource[]
  activities: CommunityActivitySource[]
}

export interface WxrItem {
  postId: string
  postType: string
  status: string
  parentId: string | null
  title: string
  creator: string | null
  attachmentUrl: string | null
  content: string
  meta: Array<{ key: string; value: string }>
}

export interface MediaManifestEntry {
  relativePath: string
  bytes: number
  extension: string
  sha256: string | null
  importable: boolean
  exclusionReason?: string
}

export interface StripeEvidenceRecord {
  subscription_id: string
  customer_id: string
  customer_email: string | null
  customer_name?: string | null
  subscription_status: string
  legacy_product_id: string
  legacy_price_id: string
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  review_reasons?: string[]
}

export interface StripeInventorySubscription {
  subscription_id: string
  customer_id: string
  customer_email: string | null
  customer_name?: string | null
  status: string
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  migration_status?: string
  prices?: Array<{
    price_id?: string
    product_id?: string
  }>
}

export interface StripeEvidenceFile {
  qualifying_records?: StripeEvidenceRecord[]
  subscriptions?: StripeInventorySubscription[]
}

export function normalizeStripeEvidenceRecords(stripeEvidence: StripeEvidenceFile): StripeEvidenceRecord[] {
  if (Array.isArray(stripeEvidence.qualifying_records)) return stripeEvidence.qualifying_records
  return (stripeEvidence.subscriptions ?? []).map((record) => {
    const primaryPrice = record.prices?.[0]
    return {
      subscription_id: record.subscription_id,
      customer_id: record.customer_id,
      customer_email: record.customer_email,
      customer_name: record.customer_name,
      subscription_status: record.status,
      legacy_product_id: primaryPrice?.product_id ?? '',
      legacy_price_id: primaryPrice?.price_id ?? '',
      current_period_end: record.current_period_end ?? null,
      cancel_at_period_end: record.cancel_at_period_end,
      review_reasons: record.migration_status ? [record.migration_status] : undefined,
    }
  })
}

export interface IdentityMergeRule {
  sourceWpUserIds: string[]
  canonicalWpUserId: string
  canonicalEmailSourceWpUserId: string
  billingMatchWpUserIds: string[]
  reason: string
}

/**
 * Operator-confirmed duplicate person. No PII is embedded in committed code:
 * - WP 74 is the legacy billing-match identity containing the typo.
 * - WP 76 is the canonical identity whose email must be used by the new platform.
 */
export const DEFAULT_IDENTITY_MERGE_RULES: IdentityMergeRule[] = [
  {
    sourceWpUserIds: ['74', '76'],
    canonicalWpUserId: '76',
    canonicalEmailSourceWpUserId: '76',
    billingMatchWpUserIds: ['74'],
    reason: 'operator_confirmed_duplicate_email_typo',
  },
]

export type TargetAccountStatus = 'active' | 'blocked'

export interface CanonicalMemberDryRun {
  canonicalKey: string
  canonicalWpUserId: string
  sourceWpUserIds: string[]
  canonicalEmail: string
  displayName: string
  sourceEmails: string[]
  fluentCrmContactIds: string[]
  stripeCustomerIds: string[]
  stripeSubscriptionIds: string[]
  accountStatus: TargetAccountStatus
  classificationReason: string
  conflicts: string[]
}

export interface IdentityCrosswalkResult {
  sourceMemberAccountCount: number
  canonicalMemberCount: number
  activeCount: number
  blockedCount: number
  members: CanonicalMemberDryRun[]
  orphanStripeRecords: Array<{
    subscriptionId: string
    customerId: string
    status: string
    reason: string
  }>
}

export interface SnapshotExpectations {
  sourceMemberAccounts: number
  canonicalMembers: number
  active: number
  blocked: number
}

export const CURRENT_REHEARSAL_EXPECTATIONS: SnapshotExpectations = {
  sourceMemberAccounts: 48,
  canonicalMembers: 47,
  active: 11,
  blocked: 36,
}

export interface SourceContentExpectations {
  wordpressUsers: number
  wordpressAdministrators: number
  fluentCrmContacts: number
  spaces: number
  spaceMemberships: number
  courses: number
  courseSections: number
  courseLessons: number
  feedPosts: number
  comments: number
  reactions: number
  lessonCompletions: number
  courseCompletions: number
  communityMedia: number
  wxrItems: number
  wxrAttachments: number
  localMediaFiles: number
}

export const CURRENT_SOURCE_CONTENT_EXPECTATIONS: SourceContentExpectations = {
  wordpressUsers: 51,
  wordpressAdministrators: 3,
  fluentCrmContacts: 48,
  spaces: 16,
  spaceMemberships: 182,
  courses: 3,
  courseSections: 10,
  courseLessons: 61,
  feedPosts: 80,
  comments: 105,
  reactions: 220,
  lessonCompletions: 103,
  courseCompletions: 6,
  communityMedia: 86,
  wxrItems: 117,
  wxrAttachments: 104,
  localMediaFiles: 386,
}

export interface BunnyReference {
  libraryId: string
  videoGuid: string
  sourceType: 'post_message' | 'post_meta'
  sourcePostId: string
}

export interface LegacyDryRunNormalization {
  identity: IdentityCrosswalkResult
  courses: CommunitySpaceSource[]
  courseSections: CommunityPostSource[]
  courseLessons: CommunityPostSource[]
  communitySpaces: CommunitySpaceSource[]
  navigationOnlySpaces: CommunitySpaceSource[]
  excludedFunctionalSpaces: CommunitySpaceSource[]
  spaceMemberships: CommunitySpaceMembershipSource[]
  feedPosts: CommunityPostSource[]
  comments: CommunityCommentSource[]
  communityReactions: CommunityReactionSource[]
  lessonCompletedReactions: CommunityReactionSource[]
  courseCompletedActivities: CommunityActivitySource[]
  bunnyReferences: BunnyReference[]
  communityMedia: CommunityMediaSource[]
}

const SELECTED_TABLES = new Set([
  'wp_users',
  'wp_usermeta',
  'wp_options',
  'wp_fc_subscribers',
  'wp_fcom_meta',
  'wp_fcom_spaces',
  'wp_fcom_posts',
  'wp_fcom_post_comments',
  'wp_fcom_post_reactions',
  'wp_fcom_space_user',
  'wp_fcom_media_archive',
  'wp_fcom_xprofile',
  'wp_fcom_user_activities',
])

const IMPORTABLE_MEDIA_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.svg',
  '.mp4',
  '.mov',
  '.webm',
  '.mp3',
  '.m4a',
  '.wav',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
])

const EXPLICITLY_BLOCKED_MEDIA_EXTENSIONS = new Set([
  '.php',
  '.phtml',
  '.phar',
  '.cgi',
  '.pl',
  '.py',
  '.rb',
  '.sh',
  '.bash',
  '.zsh',
  '.htaccess',
])

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function scalar(row: SqlRow, key: string): string | null {
  return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : null
}

interface PhpSerializedRecord {
  [key: string]: PhpSerializedValue
}

type PhpSerializedValue = string | number | boolean | null | PhpSerializedRecord

export function parsePhpSerializedRecord(value: string | null | undefined): PhpSerializedRecord {
  if (!value?.trim()) return {}
  const input = Buffer.from(value, 'utf8')
  let offset = 0

  const expect = (char: string): void => {
    if (input[offset] !== char.charCodeAt(0)) throw new Error('unexpected_php_serialized_token')
    offset += 1
  }

  const readUntil = (char: string): string => {
    const end = input.indexOf(char.charCodeAt(0), offset)
    if (end < 0) throw new Error('unterminated_php_serialized_token')
    const segment = input.subarray(offset, end).toString('utf8')
    offset = end + 1
    return segment
  }

  const parseValue = (): PhpSerializedValue => {
    const type = String.fromCharCode(input[offset++] ?? 0)
    if (type === 'N') {
      expect(';')
      return null
    }

    expect(':')
    if (type === 's') {
      const byteLength = Number(readUntil(':'))
      expect('"')
      const result = input.subarray(offset, offset + byteLength).toString('utf8')
      offset += byteLength
      expect('"')
      expect(';')
      return result
    }

    if (type === 'i' || type === 'd' || type === 'b') {
      const numericLiteral = readUntil(';')
      if (type === 'b') return numericLiteral === '1'
      return Number(numericLiteral)
    }

    if (type === 'a') {
      const count = Number(readUntil(':'))
      expect('{')
      const result: Record<string, PhpSerializedValue> = {}
      for (let index = 0; index < count; index += 1) {
        const key = parseValue()
        const child = parseValue()
        result[String(key)] = child
      }
      expect('}')
      return result
    }

    throw new Error(`unsupported_php_serialized_type_${type}`)
  }

  try {
    const parsed = parseValue()
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function serializedText(record: Record<string, PhpSerializedValue>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function unescapeMysqlQuoted(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    if (char !== '\\' || i + 1 >= raw.length) {
      out += char
      continue
    }
    const next = raw[++i]
    switch (next) {
      case '0': out += '\0'; break
      case 'n': out += '\n'; break
      case 'r': out += '\r'; break
      case 't': out += '\t'; break
      case 'Z': out += '\x1a'; break
      case 'b': out += '\b'; break
      default: out += next
    }
  }
  return out
}

function parseSqlToken(raw: string): SqlScalar {
  const sqlValue = raw.trim()
  if (/^null$/i.test(sqlValue)) return null
  if (sqlValue.startsWith("'") && sqlValue.endsWith("'")) {
    return unescapeMysqlQuoted(sqlValue.slice(1, -1))
  }
  return sqlValue
}

function splitTupleFields(raw: string): string[] {
  const fields: string[] = []
  let current = ''
  let quoted = false
  let escaped = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    if (quoted) {
      current += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === "'") {
        quoted = false
      }
      continue
    }

    if (char === "'") {
      quoted = true
      current += char
    } else if (char === ',') {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

function parseTupleList(raw: string, columns: string[]): SqlRow[] {
  const rows: SqlRow[] = []
  let cursor = 0

  while (cursor < raw.length) {
    const open = raw.indexOf('(', cursor)
    if (open < 0) break

    let quoted = false
    let escaped = false
    let depth = 1
    let i = open + 1

    for (; i < raw.length; i += 1) {
      const char = raw[i]
      if (quoted) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === "'") quoted = false
        continue
      }
      if (char === "'") quoted = true
      else if (char === '(') depth += 1
      else if (char === ')') {
        depth -= 1
        if (depth === 0) break
      }
    }

    if (i >= raw.length) throw new Error('SQL_INSERT_TUPLE_UNTERMINATED')
    const fields = splitTupleFields(raw.slice(open + 1, i))
    if (fields.length !== columns.length) {
      throw new Error(`SQL_INSERT_COLUMN_MISMATCH expected=${columns.length} actual=${fields.length}`)
    }
    const row: SqlRow = {}
    columns.forEach((column, index) => {
      row[column] = parseSqlToken(fields[index])
    })
    rows.push(row)
    cursor = i + 1
  }

  return rows
}

function findStatementEnd(sql: string, start: number): number {
  let quoted = false
  let escaped = false
  for (let i = start; i < sql.length; i += 1) {
    const char = sql[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === "'") quoted = false
      continue
    }
    if (char === "'") quoted = true
    else if (char === ';') return i
  }
  return -1
}

export function parsePhpMyAdminDump(sql: string, selectedTables: Set<string> = SELECTED_TABLES): ParsedSqlDump {
  const tables = new Map<string, SqlRow[]>()
  const marker = 'INSERT INTO `'
  let cursor = 0

  while (cursor < sql.length) {
    const start = sql.indexOf(marker, cursor)
    if (start < 0) break
    const tableStart = start + marker.length
    const tableEnd = sql.indexOf('`', tableStart)
    if (tableEnd < 0) throw new Error('SQL_INSERT_TABLE_UNTERMINATED')
    const tableName = sql.slice(tableStart, tableEnd)

    const statementEnd = findStatementEnd(sql, tableEnd + 1)
    if (statementEnd < 0) throw new Error(`SQL_INSERT_STATEMENT_UNTERMINATED table=${tableName}`)

    if (selectedTables.has(tableName)) {
      const statement = sql.slice(tableEnd + 1, statementEnd)
      const columnOpen = statement.indexOf('(')
      const columnClose = statement.indexOf(')', columnOpen + 1)
      const valuesMarker = statement.indexOf('VALUES', columnClose + 1)
      if (columnOpen < 0 || columnClose < 0 || valuesMarker < 0) {
        throw new Error(`SQL_INSERT_STRUCTURE_INVALID table=${tableName}`)
      }
      const columns = [...statement.slice(columnOpen + 1, columnClose).matchAll(/`([^`]+)`/g)].map((match) => match[1])
      if (columns.length === 0) throw new Error(`SQL_INSERT_COLUMNS_MISSING table=${tableName}`)
      const values = statement.slice(valuesMarker + 'VALUES'.length)
      const rows = parseTupleList(values, columns)
      const existing = tables.get(tableName) ?? []
      existing.push(...rows)
      tables.set(tableName, existing)
    }

    cursor = statementEnd + 1
  }

  return { tables }
}

function roleMap(parsed: ParsedSqlDump): Map<string, WordPressUserSource['role']> {
  const roles = new Map<string, WordPressUserSource['role']>()
  for (const row of parsed.tables.get('wp_usermeta') ?? []) {
    const key = scalar(row, 'meta_key') ?? ''
    if (!key.endsWith('capabilities')) continue
    const userId = scalar(row, 'user_id') ?? ''
    const value = scalar(row, 'meta_value') ?? ''
    if (value.includes('administrator')) roles.set(userId, 'administrator')
    else if (value.includes('subscriber')) roles.set(userId, 'subscriber')
    else roles.set(userId, 'other')
  }
  return roles
}

function remapSpaceTitle(title: string): { targetTitle: string; migrate: boolean; exclusionReason?: string } {
  const normalized = title.trim().toLowerCase()
  if (normalized === 'upgrade to vip' || normalized === 'upgrade to pro') {
    return { targetTitle: title, migrate: false, exclusionReason: 'legacy_upgrade_functionality' }
  }
  if (normalized === 'only vip discussion') return { targetTitle: 'Member Discussion', migrate: true }
  if (normalized === 'only vip') return { targetTitle: 'Members', migrate: true }
  return { targetTitle: title, migrate: true }
}

export function buildLegacySqlSnapshot(sql: string): LegacySqlSnapshot {
  const parsed = parsePhpMyAdminDump(sql)
  const roles = roleMap(parsed)

  const wordpressUsers = (parsed.tables.get('wp_users') ?? []).map((row): WordPressUserSource => ({
    id: scalar(row, 'ID') ?? '',
    email: normalizeEmail(scalar(row, 'user_email')),
    displayName: scalar(row, 'display_name') ?? '',
    role: roles.get(scalar(row, 'ID') ?? '') ?? 'other',
  }))

  const fluentCrmContacts = (parsed.tables.get('wp_fc_subscribers') ?? []).map((row): FluentCrmContactSource => ({
    id: scalar(row, 'id') ?? '',
    userId: scalar(row, 'user_id'),
    email: normalizeEmail(scalar(row, 'email')),
    firstName: scalar(row, 'first_name'),
    lastName: scalar(row, 'last_name'),
    status: scalar(row, 'status') ?? '',
  }))

  const communityProfiles = (parsed.tables.get('wp_fcom_xprofile') ?? []).map((row): CommunityProfileSource => {
    const metaRaw = scalar(row, 'meta')
    const meta = parsePhpSerializedRecord(metaRaw)
    return {
      id: scalar(row, 'id') ?? '',
      userId: scalar(row, 'user_id') ?? '',
      displayName: scalar(row, 'display_name') ?? '',
      avatar: scalar(row, 'avatar'),
      shortDescription: scalar(row, 'short_description'),
      shortDescriptionRendered: serializedText(meta, 'short_description_rendered'),
      website: serializedText(meta, 'website'),
      headline: serializedText(meta, 'headline'),
      coverPhoto: serializedText(meta, 'cover_photo'),
      socialLinks: {
        instagram: serializedText(meta, 'instagram'),
        twitter: serializedText(meta, 'twitter'),
        linkedin: serializedText(meta, 'linkedin'),
        facebook: serializedText(meta, 'fb'),
        youtube: serializedText(meta, 'youtube'),
      },
      status: scalar(row, 'status') ?? '',
      metaRaw,
    }
  })

  const wpOptions = parsed.tables.get('wp_options') ?? []
  const fcomMetaRows = parsed.tables.get('wp_fcom_meta') ?? []
  const optionValue = (name: string): string | null => {
    const row = wpOptions.find((item) => scalar(item, 'option_name') === name)
    return row ? scalar(row, 'option_value') : null
  }
  const fcomOptionValue = (key: string): string | null => {
    const row = fcomMetaRows.find((item) => scalar(item, 'object_type') === 'option' && scalar(item, 'meta_key') === key)
    return row ? scalar(row, 'value') : null
  }
  const portalSettingsSource: PortalSettingsSource = {
    fluentCommunitySettingsRaw: optionValue('fluent_community_settings'),
    authSettingsRaw: fcomOptionValue('auth_settings'),
    customizationSettingsRaw: fcomOptionValue('customization_settings'),
    welcomeBannerSettingsRaw: fcomOptionValue('welcome_banner_settings'),
    snippetsSettingsRaw: fcomOptionValue('snippets_settings'),
  }

  const spaces = (parsed.tables.get('wp_fcom_spaces') ?? []).map((row): CommunitySpaceSource => {
    const title = scalar(row, 'title') ?? ''
    const remap = remapSpaceTitle(title)
    return {
      id: scalar(row, 'id') ?? '',
      createdBy: scalar(row, 'created_by'),
      parentId: scalar(row, 'parent_id'),
      title,
      targetTitle: remap.targetTitle,
      slug: scalar(row, 'slug') ?? '',
      description: scalar(row, 'description'),
      type: scalar(row, 'type') ?? '',
      privacy: scalar(row, 'privacy') ?? '',
      status: scalar(row, 'status') ?? '',
      serial: Number(scalar(row, 'serial') ?? '0') || 0,
      settings: scalar(row, 'settings'),
      migrate: remap.migrate,
      ...(remap.exclusionReason ? { exclusionReason: remap.exclusionReason } : {}),
    }
  })

  const posts = (parsed.tables.get('wp_fcom_posts') ?? []).map((row): CommunityPostSource => ({
    id: scalar(row, 'id') ?? '',
    userId: scalar(row, 'user_id'),
    parentId: scalar(row, 'parent_id'),
    spaceId: scalar(row, 'space_id'),
    title: scalar(row, 'title'),
    slug: scalar(row, 'slug'),
    message: scalar(row, 'message'),
    messageRendered: scalar(row, 'message_rendered'),
    type: scalar(row, 'type') ?? '',
    contentType: scalar(row, 'content_type') ?? '',
    privacy: scalar(row, 'privacy') ?? '',
    status: scalar(row, 'status') ?? '',
    featuredImage: scalar(row, 'featured_image'),
    meta: scalar(row, 'meta'),
    isSticky: scalar(row, 'is_sticky') === '1',
    priority: Number(scalar(row, 'priority') ?? '0') || 0,
    createdAt: scalar(row, 'created_at'),
  }))

  const comments = (parsed.tables.get('wp_fcom_post_comments') ?? []).map((row): CommunityCommentSource => ({
    id: scalar(row, 'id') ?? '',
    userId: scalar(row, 'user_id'),
    postId: scalar(row, 'post_id'),
    parentId: scalar(row, 'parent_id'),
    message: scalar(row, 'message'),
    messageRendered: scalar(row, 'message_rendered'),
    meta: scalar(row, 'meta'),
    type: scalar(row, 'type') ?? '',
    contentType: scalar(row, 'content_type') ?? '',
    status: scalar(row, 'status') ?? '',
    isSticky: scalar(row, 'is_sticky') === '1',
    createdAt: scalar(row, 'created_at'),
  }))

  const reactions = (parsed.tables.get('wp_fcom_post_reactions') ?? []).map((row): CommunityReactionSource => ({
    id: scalar(row, 'id') ?? '',
    userId: scalar(row, 'user_id'),
    objectId: scalar(row, 'object_id'),
    parentId: scalar(row, 'parent_id'),
    objectType: scalar(row, 'object_type') ?? '',
    type: scalar(row, 'type') ?? '',
    createdAt: scalar(row, 'created_at'),
  }))

  const spaceMemberships = (parsed.tables.get('wp_fcom_space_user') ?? []).map((row): CommunitySpaceMembershipSource => ({
    id: scalar(row, 'id') ?? '',
    spaceId: scalar(row, 'space_id'),
    userId: scalar(row, 'user_id') ?? '',
    status: scalar(row, 'status') ?? '',
    role: scalar(row, 'role') ?? '',
  }))

  const communityMedia = (parsed.tables.get('wp_fcom_media_archive') ?? []).map((row): CommunityMediaSource => ({
    id: scalar(row, 'id') ?? '',
    objectSource: scalar(row, 'object_source') ?? '',
    mediaKey: scalar(row, 'media_key') ?? '',
    userId: scalar(row, 'user_id'),
    feedId: scalar(row, 'feed_id'),
    subObjectId: scalar(row, 'sub_object_id'),
    mediaType: scalar(row, 'media_type'),
    driver: scalar(row, 'driver') ?? '',
    mediaPath: scalar(row, 'media_path'),
    mediaUrl: scalar(row, 'media_url'),
  }))

  const activities = (parsed.tables.get('wp_fcom_user_activities') ?? []).map((row): CommunityActivitySource => ({
    id: scalar(row, 'id') ?? '',
    userId: scalar(row, 'user_id'),
    feedId: scalar(row, 'feed_id'),
    spaceId: scalar(row, 'space_id'),
    relatedId: scalar(row, 'related_id'),
    actionName: scalar(row, 'action_name') ?? '',
    createdAt: scalar(row, 'created_at'),
  }))

  return {
    wordpressUsers,
    fluentCrmContacts,
    communityProfiles,
    portalSettingsSource,
    spaces,
    posts,
    comments,
    reactions,
    spaceMemberships,
    communityMedia,
    activities,
  }
}

function xmlText(block: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
  if (!match) return null
  return match[1]
    .replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim()
}

export function parseWordPressWxr(xml: string): WxrItem[] {
  const items: WxrItem[] = []
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = match[1]
    const meta: Array<{ key: string; value: string }> = []
    for (const metaMatch of block.matchAll(/<wp:postmeta(?:\s[^>]*)?>([\s\S]*?)<\/wp:postmeta>/gi)) {
      meta.push({
        key: xmlText(metaMatch[1], 'wp:meta_key') ?? '',
        value: xmlText(metaMatch[1], 'wp:meta_value') ?? '',
      })
    }
    items.push({
      postId: xmlText(block, 'wp:post_id') ?? '',
      postType: xmlText(block, 'wp:post_type') ?? '',
      status: xmlText(block, 'wp:status') ?? '',
      parentId: xmlText(block, 'wp:post_parent') || null,
      title: xmlText(block, 'title') ?? '',
      creator: xmlText(block, 'dc:creator'),
      attachmentUrl: xmlText(block, 'wp:attachment_url'),
      content: xmlText(block, 'content:encoded') ?? '',
      meta,
    })
  }
  return items
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

export function buildLocalMediaManifest(rootDir: string): MediaManifestEntry[] {
  const root = path.resolve(rootDir)
  const entries: MediaManifestEntry[] = []

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const absolute = path.join(dir, name)
      const stat = lstatSync(absolute)
      if (stat.isSymbolicLink()) {
        entries.push({
          relativePath: path.relative(root, absolute).split(path.sep).join('/'),
          bytes: 0,
          extension: path.extname(name).toLowerCase(),
          sha256: null,
          importable: false,
          exclusionReason: 'symbolic_link',
        })
        continue
      }
      if (stat.isDirectory()) {
        walk(absolute)
        continue
      }
      if (!stat.isFile()) continue

      const relativePath = path.relative(root, absolute).split(path.sep).join('/')
      const extension = path.extname(name).toLowerCase()
      const explicitBlock = EXPLICITLY_BLOCKED_MEDIA_EXTENSIONS.has(extension) || name.toLowerCase() === '.htaccess'
      const importable = !explicitBlock && IMPORTABLE_MEDIA_EXTENSIONS.has(extension)
      entries.push({
        relativePath,
        bytes: stat.size,
        extension,
        sha256: importable ? hashFile(absolute) : null,
        importable,
        ...(!importable ? { exclusionReason: explicitBlock ? 'executable_or_control_file' : 'unsupported_extension' } : {}),
      })
    }
  }

  walk(root)
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

function groupMergeRules(rules: IdentityMergeRule[]): Map<string, IdentityMergeRule> {
  const bySourceId = new Map<string, IdentityMergeRule>()
  for (const rule of rules) {
    for (const id of rule.sourceWpUserIds) {
      if (bySourceId.has(id)) throw new Error(`IDENTITY_MERGE_RULE_OVERLAP wp=${id}`)
      bySourceId.set(id, rule)
    }
    if (!rule.sourceWpUserIds.includes(rule.canonicalWpUserId)) {
      throw new Error(`IDENTITY_MERGE_CANONICAL_NOT_MEMBER wp=${rule.canonicalWpUserId}`)
    }
    if (!rule.sourceWpUserIds.includes(rule.canonicalEmailSourceWpUserId)) {
      throw new Error(`IDENTITY_MERGE_EMAIL_SOURCE_NOT_MEMBER wp=${rule.canonicalEmailSourceWpUserId}`)
    }
  }
  return bySourceId
}

export function buildIdentityCrosswalk(
  snapshot: LegacySqlSnapshot,
  stripeEvidence: StripeEvidenceFile,
  mergeRules: IdentityMergeRule[] = DEFAULT_IDENTITY_MERGE_RULES,
): IdentityCrosswalkResult {
  const members = snapshot.wordpressUsers.filter((user) => user.role === 'subscriber')
  const stripeRecords = normalizeStripeEvidenceRecords(stripeEvidence)
  const userById = new Map(members.map((user) => [user.id, user]))
  const ruleBySourceId = groupMergeRules(mergeRules)
  const grouped = new Map<string, WordPressUserSource[]>()

  for (const user of members) {
    const rule = ruleBySourceId.get(user.id)
    const canonicalId = rule?.canonicalWpUserId ?? user.id
    const key = `wp:${canonicalId}`
    const list = grouped.get(key) ?? []
    list.push(user)
    grouped.set(key, list)
  }

  const contactsByWpId = new Map<string, FluentCrmContactSource[]>()
  for (const contact of snapshot.fluentCrmContacts) {
    if (!contact.userId) continue
    const list = contactsByWpId.get(contact.userId) ?? []
    list.push(contact)
    contactsByWpId.set(contact.userId, list)
  }

  const stripesByEmail = new Map<string, StripeEvidenceRecord[]>()
  for (const record of stripeRecords) {
    const email = normalizeEmail(record.customer_email)
    if (!email) continue
    const list = stripesByEmail.get(email) ?? []
    list.push(record)
    stripesByEmail.set(email, list)
  }

  const matchedSubscriptionIds = new Set<string>()
  const canonicalMembers: CanonicalMemberDryRun[] = []

  for (const [canonicalKey, sourceUsers] of grouped) {
    const canonicalWpUserId = canonicalKey.slice(3)
    const rule = mergeRules.find((candidate) => candidate.canonicalWpUserId === canonicalWpUserId)
    const canonicalEmailSourceId = rule?.canonicalEmailSourceWpUserId ?? canonicalWpUserId
    const canonicalEmailSource = userById.get(canonicalEmailSourceId)
    if (!canonicalEmailSource) throw new Error(`CANONICAL_EMAIL_SOURCE_MISSING wp=${canonicalEmailSourceId}`)

    const sourceWpUserIds = sourceUsers.map((user) => user.id).sort((a, b) => Number(a) - Number(b))
    const sourceEmails = [...new Set(sourceUsers.map((user) => normalizeEmail(user.email)).filter(Boolean))]
    const contactRows = sourceWpUserIds.flatMap((id) => contactsByWpId.get(id) ?? [])
    const contactEmails = contactRows.map((contact) => normalizeEmail(contact.email)).filter(Boolean)
    const billingAliasEmails = (rule?.billingMatchWpUserIds ?? [])
      .map((id) => userById.get(id)?.email)
      .map(normalizeEmail)
      .filter(Boolean)
    const matchEmails = [...new Set([...sourceEmails, ...contactEmails, ...billingAliasEmails])]
    const stripeMatches = matchEmails.flatMap((email) => stripesByEmail.get(email) ?? [])
    for (const record of stripeMatches) matchedSubscriptionIds.add(record.subscription_id)

    const activeMatches = stripeMatches.filter((record) => record.subscription_status === 'active')
    const pastDueMatches = stripeMatches.filter((record) => record.subscription_status === 'past_due')
    const conflicts: string[] = []
    if (sourceWpUserIds.length > 1) conflicts.push(rule?.reason ?? 'multiple_wordpress_source_accounts')
    if (pastDueMatches.length > 0 && activeMatches.length === 0) conflicts.push('stripe_past_due_fail_closed')
    const hasUnreviewedMultipleStripeRecords = stripeMatches.length > 1 && !rule
    if (hasUnreviewedMultipleStripeRecords) conflicts.push('multiple_stripe_records_same_person')
    const hasUnambiguousActiveSubscription = activeMatches.length === 1 && !hasUnreviewedMultipleStripeRecords

    canonicalMembers.push({
      canonicalKey,
      canonicalWpUserId,
      sourceWpUserIds,
      canonicalEmail: normalizeEmail(canonicalEmailSource.email),
      displayName: canonicalEmailSource.displayName,
      sourceEmails: matchEmails,
      fluentCrmContactIds: contactRows.map((contact) => contact.id),
      stripeCustomerIds: [...new Set(stripeMatches.map((record) => record.customer_id))],
      stripeSubscriptionIds: [...new Set(stripeMatches.map((record) => record.subscription_id))],
      accountStatus: hasUnambiguousActiveSubscription ? 'active' : 'blocked',
      classificationReason: hasUnreviewedMultipleStripeRecords
        ? 'multiple_stripe_records_review_required'
        : hasUnambiguousActiveSubscription
        ? 'current_qualifying_stripe_active'
        : pastDueMatches.length > 0
          ? 'stripe_past_due_fail_closed'
          : 'no_current_qualifying_stripe_active',
      conflicts,
    })
  }

  canonicalMembers.sort((a, b) => Number(a.canonicalWpUserId) - Number(b.canonicalWpUserId))
  const activeCount = canonicalMembers.filter((member) => member.accountStatus === 'active').length
  const blockedCount = canonicalMembers.filter((member) => member.accountStatus === 'blocked').length

  const orphanStripeRecords = stripeRecords
    .filter((record) => !matchedSubscriptionIds.has(record.subscription_id))
    .map((record) => ({
      subscriptionId: record.subscription_id,
      customerId: record.customer_id,
      status: record.subscription_status,
      reason: record.customer_email ? 'no_wordpress_identity_match' : 'missing_customer_email',
    }))

  return {
    sourceMemberAccountCount: members.length,
    canonicalMemberCount: canonicalMembers.length,
    activeCount,
    blockedCount,
    members: canonicalMembers,
    orphanStripeRecords,
  }
}

export function assertSnapshotExpectations(
  result: IdentityCrosswalkResult,
  expected: SnapshotExpectations = CURRENT_REHEARSAL_EXPECTATIONS,
): void {
  const failures: string[] = []
  if (result.sourceMemberAccountCount !== expected.sourceMemberAccounts) {
    failures.push(`sourceMemberAccounts expected=${expected.sourceMemberAccounts} actual=${result.sourceMemberAccountCount}`)
  }
  if (result.canonicalMemberCount !== expected.canonicalMembers) {
    failures.push(`canonicalMembers expected=${expected.canonicalMembers} actual=${result.canonicalMemberCount}`)
  }
  if (result.activeCount !== expected.active) failures.push(`active expected=${expected.active} actual=${result.activeCount}`)
  if (result.blockedCount !== expected.blocked) failures.push(`blocked expected=${expected.blocked} actual=${result.blockedCount}`)
  if (failures.length > 0) throw new Error(`LEGACY_SNAPSHOT_EXPECTATION_FAILED ${failures.join('; ')}`)
}

export function assertRealSourceContentExpectations(
  snapshot: LegacySqlSnapshot,
  normalization: LegacyDryRunNormalization,
  wxrItems: WxrItem[],
  mediaManifest: MediaManifestEntry[],
  expected: SourceContentExpectations = CURRENT_SOURCE_CONTENT_EXPECTATIONS,
): void {
  const actual: SourceContentExpectations = {
    wordpressUsers: snapshot.wordpressUsers.length,
    wordpressAdministrators: snapshot.wordpressUsers.filter((user) => user.role === 'administrator').length,
    fluentCrmContacts: snapshot.fluentCrmContacts.length,
    spaces: snapshot.spaces.length,
    spaceMemberships: snapshot.spaceMemberships.length,
    courses: normalization.courses.length,
    courseSections: normalization.courseSections.length,
    courseLessons: normalization.courseLessons.length,
    feedPosts: normalization.feedPosts.length,
    comments: normalization.comments.length,
    reactions: snapshot.reactions.length,
    lessonCompletions: normalization.lessonCompletedReactions.length,
    courseCompletions: normalization.courseCompletedActivities.length,
    communityMedia: normalization.communityMedia.length,
    wxrItems: wxrItems.length,
    wxrAttachments: wxrItems.filter((item) => item.postType === 'attachment').length,
    localMediaFiles: mediaManifest.length,
  }

  const failures = (Object.keys(expected) as Array<keyof SourceContentExpectations>)
    .filter((key) => actual[key] !== expected[key])
    .map((key) => `${key} expected=${expected[key]} actual=${actual[key]}`)

  if (failures.length > 0) {
    throw new Error(`LEGACY_SOURCE_CONTENT_EXPECTATION_FAILED ${failures.join('; ')}`)
  }
}

function extractBunnyReferences(posts: CommunityPostSource[], libraryId = '581531'): BunnyReference[] {
  const seen = new Set<string>()
  const references: BunnyReference[] = []
  const pattern = new RegExp(`(?:embed\\/|\\b)${libraryId}\\/([0-9a-f]{8}-[0-9a-f-]{27,36})`, 'ig')

  for (const post of posts) {
    for (const [sourceType, value] of [
      ['post_message', post.message],
      ['post_meta', post.meta],
    ] as const) {
      if (!value) continue
      for (const match of value.matchAll(pattern)) {
        const videoGuid = match[1].toLowerCase()
        const key = `${post.id}:${sourceType}:${videoGuid}`
        if (seen.has(key)) continue
        seen.add(key)
        references.push({ libraryId, videoGuid, sourceType, sourcePostId: post.id })
      }
    }
  }

  return references.sort((a, b) => a.sourcePostId.localeCompare(b.sourcePostId) || a.videoGuid.localeCompare(b.videoGuid))
}

export function buildLegacyDryRunNormalization(
  snapshot: LegacySqlSnapshot,
  stripeEvidence: StripeEvidenceFile,
): LegacyDryRunNormalization {
  const identity = buildIdentityCrosswalk(snapshot, stripeEvidence)
  return {
    identity,
    courses: snapshot.spaces.filter((space) => space.type === 'course' && space.migrate),
    courseSections: snapshot.posts.filter((post) => post.type === 'course_section'),
    courseLessons: snapshot.posts.filter((post) => post.type === 'course_lesson'),
    communitySpaces: snapshot.spaces.filter((space) => space.type === 'community' && space.migrate),
    navigationOnlySpaces: snapshot.spaces.filter(
      (space) => space.migrate && space.type !== 'course' && space.type !== 'community',
    ),
    excludedFunctionalSpaces: snapshot.spaces.filter((space) => !space.migrate),
    spaceMemberships: snapshot.spaceMemberships,
    feedPosts: snapshot.posts.filter((post) => post.type === 'text'),
    comments: snapshot.comments,
    communityReactions: snapshot.reactions.filter((reaction) => reaction.objectType !== 'lesson_completed'),
    lessonCompletedReactions: snapshot.reactions.filter(
      (reaction) => reaction.objectType === 'lesson_completed' && reaction.type === 'completed',
    ),
    courseCompletedActivities: snapshot.activities.filter((activity) => activity.actionName === 'course_completed'),
    bunnyReferences: extractBunnyReferences(snapshot.posts),
    communityMedia: snapshot.communityMedia,
  }
}




export interface WordPressAttachmentReconciliation {
  sourceAttachmentCount: number
  mappedCount: number
  missingCount: number
  mappings: Array<{
    postId: string
    sourceRelativePath: string
    localRelativePath: string | null
    status: 'mapped' | 'missing'
  }>
}

export interface BunnyInventoryVideo {
  video_guid?: string
  guid?: string
  title?: string
  status?: string
  status_label?: string
  library_id?: number
  duration_seconds?: number | null
  thumbnail_url?: string | null
  thumbnail_filename?: string | null
  width?: number | null
  height?: number | null
  framerate?: number | null
}

export interface BunnyInventoryFile {
  library?: { id?: number }
  library_id?: number
  videos: BunnyInventoryVideo[]
}

export interface NormalizedBunnyInventoryVideo {
  video_guid: string
  title?: string
  status?: string
  library_id?: number
  duration_seconds?: number | null
  thumbnail_url?: string | null
  width?: number | null
  height?: number | null
  framerate?: number | null
}

export function normalizeBunnyInventoryVideos(inventory?: BunnyInventoryFile): NormalizedBunnyInventoryVideo[] {
  if (!inventory) return []
  const fallbackLibraryId = inventory.library_id ?? inventory.library?.id
  return (inventory.videos ?? []).flatMap((video) => {
    const videoGuid = video.video_guid ?? video.guid
    if (!videoGuid) return []
    const sourceStatus = video.status ?? video.status_label
    const status = sourceStatus === 'error' ? 'failed' : sourceStatus === 'finished' ? 'resolution_finished' : sourceStatus
    return [{
      video_guid: videoGuid,
      title: video.title,
      status,
      library_id: video.library_id ?? fallbackLibraryId,
      duration_seconds: video.duration_seconds,
      thumbnail_url: video.thumbnail_url,
      width: video.width,
      height: video.height,
      framerate: video.framerate,
    }]
  })
}

export interface BunnyReconciliation {
  sourceReferenceCount: number
  uniqueReferencedGuids: number
  matchedGuids: string[]
  missingGuids: string[]
  unreferencedInventoryGuids: string[]
}

export function reconcileWordPressAttachments(
  wxrItems: WxrItem[],
  mediaManifest: MediaManifestEntry[],
): WordPressAttachmentReconciliation {
  const manifestPaths = new Map(mediaManifest.map((entry) => [entry.relativePath.toLowerCase(), entry]))
  const mappings = wxrItems
    .filter((item) => item.postType === 'attachment')
    .map((item) => {
      const attachedFile = item.meta.find((entry) => entry.key === '_wp_attached_file')?.value?.replace(/^\/+/, '') ?? ''
      const direct = attachedFile ? manifestPaths.get(attachedFile.toLowerCase()) : undefined
      const urlPath = item.attachmentUrl
        ? decodeURIComponent(new URL(item.attachmentUrl).pathname).replace(/^.*\/wp-content\/uploads\//i, '').replace(/^\/+/, '')
        : ''
      const fallback = !direct && urlPath ? manifestPaths.get(urlPath.toLowerCase()) : undefined
      const match = direct ?? fallback
      const sourceRelativePath = attachedFile || urlPath
      return {
        postId: item.postId,
        sourceRelativePath,
        localRelativePath: match?.relativePath ?? null,
        status: match && match.importable ? 'mapped' as const : 'missing' as const,
      }
    })

  return {
    sourceAttachmentCount: mappings.length,
    mappedCount: mappings.filter((entry) => entry.status === 'mapped').length,
    missingCount: mappings.filter((entry) => entry.status === 'missing').length,
    mappings,
  }
}

export function reconcileBunnyReferences(
  references: BunnyReference[],
  inventory: BunnyInventoryFile,
  expectedLibraryId = '581531',
): BunnyReconciliation {
  const inventoryGuids = new Set(
    normalizeBunnyInventoryVideos(inventory)
      .filter((video) => String(video.library_id ?? '') === expectedLibraryId)
      .filter((video) => video.status !== 'failed')
      .map((video) => video.video_guid.toLowerCase()),
  )
  const referencedGuids = [...new Set(references
    .filter((reference) => reference.libraryId === expectedLibraryId)
    .map((reference) => reference.videoGuid.toLowerCase()))].sort()
  const matchedGuids = referencedGuids.filter((guid) => inventoryGuids.has(guid))
  const missingGuids = referencedGuids.filter((guid) => !inventoryGuids.has(guid))
  const referencedSet = new Set(referencedGuids)
  const unreferencedInventoryGuids = [...inventoryGuids].filter((guid) => !referencedSet.has(guid)).sort()

  return {
    sourceReferenceCount: references.filter((reference) => reference.libraryId === expectedLibraryId).length,
    uniqueReferencedGuids: referencedGuids.length,
    matchedGuids,
    missingGuids,
    unreferencedInventoryGuids,
  }
}

export function assertPiiOutputOutsideRepo(outputPath: string, repoRoot = process.cwd()): string {
  const resolvedOutput = path.resolve(outputPath)
  const resolvedRepo = path.resolve(repoRoot)
  const relative = path.relative(resolvedRepo, resolvedOutput)
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('PII_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY')
  }
  return resolvedOutput
}
