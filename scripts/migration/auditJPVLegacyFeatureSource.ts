#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { parsePhpMyAdminDump, parsePhpSerializedRecord } from './legacySourceDryRun'

const sqlPath = '/private/tmp/127_0_0_1.sql'
const sql = readFileSync(sqlPath, 'utf8')
const parsed = parsePhpMyAdminDump(sql, new Set(['wp_usermeta', 'wp_options', 'wp_fcom_xprofile', 'wp_fcom_media_archive', 'wp_fcom_meta', 'wp_fcom_spaces']))

const featurePattern = /(headline|bio|about|website|social|cover|logo|banner|brand|portal|color|colour|css|javascript|script)/i
const portalOptionPattern = /(fluent|community|portal|brand|logo|banner|color|colour|css|javascript|script)/i

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== '0' && value.trim() !== 'null'
}

function safeValueFeatures(value: string | null | undefined): string[] {
  if (!value) return []
  const flags = new Set<string>()
  const candidates = ['headline', 'bio', 'about', 'website', 'social', 'cover', 'logo', 'banner', 'brand', 'portal', 'color', 'colour', 'css', 'javascript', 'script']
  for (const candidate of candidates) {
    if (new RegExp(candidate, 'i').test(value)) flags.add(candidate)
  }
  return [...flags].sort()
}

type ParsedSerializedValue = string | number | boolean | null | { structured: true; nonEmpty: boolean } | undefined

function parsedValueNonEmpty(value: ParsedSerializedValue): boolean {
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '0' && value.trim() !== 'null'
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  if (typeof value === 'boolean') return value
  return Boolean(value && typeof value === 'object' && value.nonEmpty)
}

function safePhpSerializedStructure(value: string): { keyPaths: string[]; nonEmptyKeyPaths: string[] } {
  const input = Buffer.from(value, 'utf8')
  let offset = 0
  const keys = new Set<string>()
  const nonEmptyKeys = new Set<string>()
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
  const parseValue = (): ParsedSerializedValue => {
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
      for (let index = 0; index < count; index += 1) {
        const key = parseValue()
        const child = parseValue()
        if (typeof key === 'string') {
          keys.add(key)
          if (parsedValueNonEmpty(child)) nonEmptyKeys.add(key)
        }
      }
      expect('}')
      return { structured: true, nonEmpty: count > 0 }
    }
    throw new Error(`unsupported_php_serialized_type_${type}`)
  }
  try {
    parseValue()
    return { keyPaths: [...keys].sort(), nonEmptyKeyPaths: [...nonEmptyKeys].sort() }
  } catch {
    return { keyPaths: [], nonEmptyKeyPaths: [] }
  }
}

function safeJsonStructure(value: string | null | undefined): { format: string; keyPaths: string[]; nonEmptyKeyPaths: string[] } {
  if (!value) return { format: 'empty', keyPaths: [], nonEmptyKeyPaths: [] }
  try {
    const parsed = JSON.parse(value)
    const paths = new Set<string>()
    const nonEmptyPaths = new Set<string>()
    const isNonEmpty = (current: unknown): boolean => {
      if (typeof current === 'string') return current.trim() !== '' && current.trim() !== '0' && current.trim() !== 'null'
      if (typeof current === 'number') return Number.isFinite(current) && current !== 0
      if (typeof current === 'boolean') return current
      if (Array.isArray(current)) return current.length > 0
      return Boolean(current && typeof current === 'object' && Object.keys(current as Record<string, unknown>).length > 0)
    }
    const walk = (current: unknown, prefix = '', depth = 0): void => {
      if (depth > 4 || current === null || typeof current !== 'object') return
      if (Array.isArray(current)) {
        if (current.length > 0) walk(current[0], `${prefix}[]`, depth + 1)
        return
      }
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key
        paths.add(path)
        if (isNonEmpty(child)) nonEmptyPaths.add(path)
        walk(child, path, depth + 1)
      }
    }
    walk(parsed)
    return { format: 'json', keyPaths: [...paths].sort(), nonEmptyKeyPaths: [...nonEmptyPaths].sort() }
  } catch {
    const trimmed = value.trim()
    if (trimmed.startsWith('a:')) {
      const structure = safePhpSerializedStructure(value)
      return { format: 'php_serialized', ...structure }
    }
    return { format: 'opaque', keyPaths: [], nonEmptyKeyPaths: [] }
  }
}

const usermeta = parsed.tables.get('wp_usermeta') ?? []
const profileMeta = new Map<string, { rows: number; nonEmpty: number; users: Set<string>; valueFeatures: Set<string> }>()
for (const row of usermeta) {
  const key = row.meta_key ?? ''
  const value = row.meta_value
  if (!featurePattern.test(key) && safeValueFeatures(value).length === 0) continue
  const current = profileMeta.get(key) ?? { rows: 0, nonEmpty: 0, users: new Set<string>(), valueFeatures: new Set<string>() }
  current.rows += 1
  if (nonEmpty(value)) current.nonEmpty += 1
  if (row.user_id) current.users.add(row.user_id)
  for (const flag of safeValueFeatures(value)) current.valueFeatures.add(flag)
  profileMeta.set(key, current)
}

const options = parsed.tables.get('wp_options') ?? []
const targetedPortalOptionNames = new Set(['fluent_community_settings', 'fluentcrm-global-settings', 'fluent_cart_store_settings'])
const portalOptions = options
  .filter((row) => portalOptionPattern.test(row.option_name ?? '') || safeValueFeatures(row.option_value).length > 0)
  .map((row) => ({
    optionName: row.option_name ?? '',
    nonEmpty: nonEmpty(row.option_value),
    valueBytes: Buffer.byteLength(row.option_value ?? '', 'utf8'),
    valueFeatures: safeValueFeatures(row.option_value),
    ...(targetedPortalOptionNames.has(row.option_name ?? '') ? { structure: safeJsonStructure(row.option_value) } : {}),
  }))
  .sort((a, b) => a.optionName.localeCompare(b.optionName))

const tableShapes = ['wp_fcom_xprofile', 'wp_fcom_media_archive', 'wp_fcom_meta'].map((tableName) => {
  const rows = parsed.tables.get(tableName) ?? []
  return {
    tableName,
    rows: rows.length,
    columns: [...new Set(rows.flatMap((row) => Object.keys(row)))].sort(),
  }
})

const xprofiles = parsed.tables.get('wp_fcom_xprofile') ?? []
const xprofileMetaKeyPopulation = [...xprofiles.reduce((counts, row) => {
  for (const key of safeJsonStructure(row.meta).keyPaths) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}, new Map<string, number>()).entries()]
  .map(([key, count]) => ({ key, count }))
  .sort((a, b) => a.key.localeCompare(b.key))

const xprofileMetaNonEmptyKeyPopulation = [...xprofiles.reduce((counts, row) => {
  for (const key of safeJsonStructure(row.meta).nonEmptyKeyPaths) counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}, new Map<string, number>()).entries()]
  .map(([key, count]) => ({ key, count }))
  .sort((a, b) => a.key.localeCompare(b.key))

const xprofileFieldPopulation = {
  avatar: xprofiles.filter((row) => nonEmpty(row.avatar)).length,
  shortDescription: xprofiles.filter((row) => nonEmpty(row.short_description)).length,
  meta: xprofiles.filter((row) => nonEmpty(row.meta)).length,
  metaKeyPopulation: xprofileMetaKeyPopulation,
  metaNonEmptyKeyPopulation: xprofileMetaNonEmptyKeyPopulation,
  metaStructures: [...new Map(
    xprofiles
      .filter((row) => nonEmpty(row.meta))
      .map((row) => safeJsonStructure(row.meta))
      .map((structure) => [`${structure.format}:${structure.keyPaths.join(',')}`, structure]),
  ).values()],
}

const fcomMetaRows = parsed.tables.get('wp_fcom_meta') ?? []
const fcomMetaAggregate = [...fcomMetaRows.reduce((counts, row) => {
  const key = `${row.object_type ?? 'unknown'}\u0000${row.meta_key ?? 'unknown'}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}, new Map<string, number>()).entries()]
  .map(([key, count]) => {
    const [objectType, metaKey] = key.split('\u0000')
    return { objectType, metaKey, count }
  })
  .sort((a, b) => `${a.objectType}:${a.metaKey}`.localeCompare(`${b.objectType}:${b.metaKey}`))

const targetedFcomOptionKeys = new Set([
  'customization_settings',
  'welcome_banner_settings',
  'onboarding_sub_settings',
  'snippets_settings',
  'auth_settings',
])

function safeNestedKeyPaths(value: string | null | undefined): Array<{ path: string; type: string; nonEmpty: boolean }> {
  const record = parsePhpSerializedRecord(value)
  const rows: Array<{ path: string; type: string; nonEmpty: boolean }> = []
  const visit = (current: unknown, path = ''): void => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${key}` : key
      const type = child === null ? 'null' : Array.isArray(child) ? 'array' : typeof child === 'object' ? 'object' : typeof child
      const childNonEmpty = typeof child === 'string'
        ? child.trim() !== '' && child.trim() !== '0' && child.trim() !== 'null'
        : typeof child === 'number'
          ? child !== 0
          : typeof child === 'boolean'
            ? child
            : Boolean(child && typeof child === 'object' && Object.keys(child as Record<string, unknown>).length > 0)
      rows.push({ path: nextPath, type, nonEmpty: childNonEmpty })
      visit(child, nextPath)
    }
  }
  visit(record)
  return rows.sort((a, b) => a.path.localeCompare(b.path))
}

const fcomOptionStructures = fcomMetaRows
  .filter((row) => row.object_type === 'option' && targetedFcomOptionKeys.has(row.meta_key ?? ''))
  .map((row) => ({
    metaKey: row.meta_key ?? '',
    valueBytes: Buffer.byteLength(row.value ?? '', 'utf8'),
    valueFeatures: safeValueFeatures(row.value),
    structure: safeJsonStructure(row.value),
    nestedKeyPaths: safeNestedKeyPaths(row.value),
  }))
  .sort((a, b) => a.metaKey.localeCompare(b.metaKey))

const mediaRows = parsed.tables.get('wp_fcom_media_archive') ?? []
const mediaAggregate = [...mediaRows.reduce((counts, row) => {
  const key = `${row.object_source ?? 'unknown'}\u0000${row.media_type ?? 'unknown'}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}, new Map<string, number>()).entries()]
  .map(([key, count]) => {
    const [objectSource, mediaType] = key.split('\u0000')
    return { objectSource, mediaType, count }
  })
  .sort((a, b) => `${a.objectSource}:${a.mediaType}`.localeCompare(`${b.objectSource}:${b.mediaType}`))

const relevantMediaKeys = [...mediaRows.reduce((counts, row) => {
  const key = row.media_key ?? ''
  if (!/(cover|avatar|logo|banner|onboarding|general)/i.test(key)) return counts
  counts.set(key, (counts.get(key) ?? 0) + 1)
  return counts
}, new Map<string, number>()).entries()]
  .map(([mediaKey, count]) => ({ mediaKey, count }))
  .sort((a, b) => a.mediaKey.localeCompare(b.mediaKey))

const spaceIds = new Set((parsed.tables.get('wp_fcom_spaces') ?? []).map((row) => row.id ?? '').filter(Boolean))
const spaceMediaTargetEvidence = mediaRows
  .filter((row) => row.object_source === 'space_cover_photo' || row.object_source === 'space_og_image')
  .map((row) => ({
    objectSource: row.object_source ?? '',
    subObjectMatchesSpace: Boolean(row.sub_object_id && spaceIds.has(row.sub_object_id)),
    feedMatchesSpace: Boolean(row.feed_id && spaceIds.has(row.feed_id)),
    hasUserId: nonEmpty(row.user_id),
  }))
  .sort((a, b) => a.objectSource.localeCompare(b.objectSource))

const portalSourceValues = [
  ...options.map((row) => ({ source: `wp_options:${row.option_name ?? 'unknown'}`, value: row.option_value ?? '' })),
  ...fcomMetaRows.map((row) => ({ source: `wp_fcom_meta:${row.object_type ?? 'unknown'}:${row.meta_key ?? 'unknown'}`, value: row.value ?? '' })),
]

function tokenReferencePaths(value: string, tokens: string[]): string[] {
  const matches = new Set<string>()
  const visit = (current: unknown, path = ''): void => {
    if (typeof current === 'string') {
      if (tokens.some((token) => current.includes(token))) matches.add(path || '<root>')
      return
    }
    if (!current || typeof current !== 'object') return
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      visit(child, path ? `${path}.${key}` : key)
    }
  }

  const serialized = parsePhpSerializedRecord(value)
  if (Object.keys(serialized).length > 0) visit(serialized)
  else {
    try {
      visit(JSON.parse(value))
    } catch {
      if (tokens.some((token) => value.includes(token))) matches.add('<opaque>')
    }
  }
  return [...matches].sort()
}

const platformMediaRelationshipAudit = mediaRows
  .filter((row) => row.object_source === 'onboarding' || row.object_source === 'general')
  .map((row) => {
    const tokens = [row.media_path, row.media_url, row.media_key]
      .filter((value): value is string => typeof value === 'string' && value.trim().length >= 8)
    const referencedBy = portalSourceValues
      .flatMap((candidate) => tokenReferencePaths(candidate.value, tokens).map((keyPath) => `${candidate.source}#${keyPath}`))
      .sort()
    return {
      id: row.id ?? '',
      objectSource: row.object_source ?? '',
      mediaKey: row.media_key ?? '',
      hasUserId: nonEmpty(row.user_id),
      hasFeedId: nonEmpty(row.feed_id),
      hasSubObjectId: nonEmpty(row.sub_object_id),
      referencedBy,
    }
  })
  .sort((a, b) => a.id.localeCompare(b.id))

let orphanStripeAggregate: Array<{ status: string; reason: string; count: number }> = []
try {
  const dryRunReport = JSON.parse(readFileSync('/private/tmp/jpv-legacy-source-dry-run-2026-08-15.json', 'utf8')) as {
    identityCrosswalk?: { orphanStripeRecords?: Array<{ status?: string; reason?: string }> }
  }
  const counts = new Map<string, number>()
  for (const record of dryRunReport.identityCrosswalk?.orphanStripeRecords ?? []) {
    const status = record.status ?? 'unknown'
    const reason = record.reason ?? 'unknown'
    const key = `${status}\u0000${reason}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  orphanStripeAggregate = [...counts.entries()]
    .map(([key, count]) => {
      const [status, reason] = key.split('\u0000')
      return { status, reason, count }
    })
    .sort((a, b) => `${a.status}:${a.reason}`.localeCompare(`${b.status}:${b.reason}`))
} catch {
  orphanStripeAggregate = []
}

const insertTables = [...new Set([...sql.matchAll(/INSERT INTO `([^`]+)`/g)].map((match) => match[1]))]
  .filter((name) => /(fcom|fluent|community)/i.test(name))
  .sort()

const report = {
  source: { path: sqlPath, bytes: Buffer.byteLength(sql, 'utf8') },
  profileMeta: [...profileMeta.entries()]
    .map(([metaKey, stats]) => ({
      metaKey,
      rows: stats.rows,
      nonEmpty: stats.nonEmpty,
      uniqueUsers: stats.users.size,
      valueFeatures: [...stats.valueFeatures].sort(),
    }))
    .sort((a, b) => a.metaKey.localeCompare(b.metaKey)),
  portalOptions,
  tableShapes,
  xprofileFieldPopulation,
  fcomMetaAggregate,
  fcomOptionStructures,
  mediaAggregate,
  relevantMediaKeys,
  spaceMediaTargetEvidence,
  platformMediaRelationshipAudit,
  orphanStripeAggregate,
  fluentCommunityInsertTables: insertTables,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
