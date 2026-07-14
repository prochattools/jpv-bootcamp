import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { courseSeeds } from '../../src/lib/payloadCourse/seedData'

export const PROGRAMME_CONTENT_FORMAT = 'jpv-programme-content.v1'
export const REQUIRED_PROGRAMME_WEEK_COUNT = 8
export const REPOSITORY_ROOT = path.resolve(__dirname, '../..')

const PLACEHOLDER_MARKERS = [
  'todo',
  'tbd',
  'lorem ipsum',
  'example content',
  'coming soon',
  'placeholder',
] as const

const PROGRAMME_STATUSES = ['draft', 'review', 'approved'] as const
const PACKAGE_PURPOSES = ['client_submission', 'test_fixture'] as const
const PUBLICATION_INTENTS = ['preview_only', 'candidate', 'approved_for_import'] as const
const WEEK_STATUSES = ['draft', 'review', 'approved'] as const
const LESSON_STATUSES = ['draft', 'review', 'approved'] as const
const RESOURCE_STATUSES = ['draft', 'approved', 'archived'] as const
const LESSON_TYPES = ['video', 'reading', 'worksheet', 'exercise', 'call'] as const
const RESOURCE_TYPES = ['download', 'link', 'video_reference'] as const
const APPROVAL_STATUSES = ['not_approved', 'approved', 'rejected'] as const

type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number]
type PackagePurpose = (typeof PACKAGE_PURPOSES)[number]
type PublicationIntent = (typeof PUBLICATION_INTENTS)[number]
type WeekStatus = (typeof WEEK_STATUSES)[number]
type LessonStatus = (typeof LESSON_STATUSES)[number]
type ResourceStatus = (typeof RESOURCE_STATUSES)[number]
type LessonType = (typeof LESSON_TYPES)[number]
type ResourceType = (typeof RESOURCE_TYPES)[number]
type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export type ProgrammeResource = {
  id: string
  label: string
  resourceType: ResourceType
  source: string
  accessibilityLabel: string
  status: ResourceStatus
}

export type ProgrammeLesson = {
  id: string
  slug: string
  sequence: number
  title: string
  summary: string
  body: string
  estimatedDuration: string
  lessonType: LessonType
  previewAvailable: boolean
  videoReference?: string | null
  status: LessonStatus
  resources: ProgrammeResource[]
}

export type ProgrammeWeek = {
  id: string
  slug: string
  sequence: number
  title: string
  summary: string
  learningOutcomes: string[]
  estimatedDuration: string
  status: WeekStatus
  lessons: ProgrammeLesson[]
}

export type ProgrammeApproval = {
  approvalStatus: ApprovalStatus
  approver: string | null
  approvalDate: string | null
  approvalReference: string | null
  explicitClientApproval: boolean
  publicationApproved: boolean
  notes?: string | null
}

export type ProgrammeContentPackage = {
  packageFormat: typeof PROGRAMME_CONTENT_FORMAT
  packagePurpose: PackagePurpose
  programme: {
    id: string
    title: string
    shortSummary: string
    longDescription: string
    version: string
    status: ProgrammeStatus
    locale: string
    weekCount: number
    publicationIntent: PublicationIntent
  }
  weeks: ProgrammeWeek[]
  approval: ProgrammeApproval
}

export type ValidationIssue = {
  code: string
  path: string
  message: string
}

export type ValidationStats = {
  weekCount: number
  lessonCount: number
  resourceCount: number
  draftCount: number
  approvedCount: number
  previewLessonCount: number
}

export type ProgrammeValidationResult = {
  inputPath: string
  resolvedPath: string
  checksum: string
  packageData: ProgrammeContentPackage
  stats: ValidationStats
  structuralValid: boolean
  releaseEligible: boolean
  errors: ValidationIssue[]
  blockers: ValidationIssue[]
}

export type ImportPlanOperation = {
  kind: 'programme' | 'week' | 'lesson' | 'resource'
  action: 'create' | 'update' | 'unchanged' | 'archive_or_defer'
  id: string
  targetKey: string
  detail: string
}

export type ProgrammeImportPlan = {
  packagePath: string
  checksum: string
  structuralValid: boolean
  releaseEligible: boolean
  operations: ImportPlanOperation[]
  unresolvedReferences: string[]
  resourceDependencies: string[]
  publicationChanges: string[]
  entitlementImplications: string[]
  destructiveOperationWarnings: string[]
  blockers: ValidationIssue[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  issueList: ValidationIssue[],
  basePath: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issueList.push({
        code: 'unknown_field',
        path: basePath ? `${basePath}.${key}` : key,
        message: `Unknown field "${key}" is not allowed.`,
      })
    }
  }
}

function pushIssue(issueList: ValidationIssue[], code: string, pathText: string, message: string): void {
  issueList.push({ code, path: pathText, message })
}

function requireObject(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    pushIssue(issueList, 'object_required', pathText, 'Expected an object.')
    return null
  }
  return value
}

function requireString(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): string | null {
  if (typeof value !== 'string') {
    pushIssue(issueList, 'string_required', pathText, 'Expected a string.')
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    pushIssue(issueList, 'empty_string', pathText, 'Required string must not be empty.')
    return null
  }
  return trimmed
}

function requireNullableString(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): string | null {
  if (value === null || value === undefined) return null
  return requireString(value, issueList, pathText)
}

function requireBoolean(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): boolean | null {
  if (typeof value !== 'boolean') {
    pushIssue(issueList, 'boolean_required', pathText, 'Expected a boolean.')
    return null
  }
  return value
}

function requireNumber(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushIssue(issueList, 'number_required', pathText, 'Expected a finite number.')
    return null
  }
  return value
}

function requireEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  issueList: ValidationIssue[],
  pathText: string,
): T | null {
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    pushIssue(issueList, 'enum_value_invalid', pathText, `Expected one of: ${allowedValues.join(', ')}.`)
    return null
  }
  return value as T
}

function requireStringArray(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): string[] | null {
  if (!Array.isArray(value)) {
    pushIssue(issueList, 'array_required', pathText, 'Expected an array.')
    return null
  }
  const parsed: string[] = []
  for (const [index, item] of value.entries()) {
    const parsedItem = requireString(item, issueList, `${pathText}[${index}]`)
    if (parsedItem) parsed.push(parsedItem)
  }
  if (parsed.length === 0) {
    pushIssue(issueList, 'array_empty', pathText, 'At least one value is required.')
  }
  return parsed
}

function requireSafeIdentifier(
  value: unknown,
  issueList: ValidationIssue[],
  pathText: string,
): string | null {
  const parsed = requireString(value, issueList, pathText)
  if (!parsed) return null
  if (!/^[a-z0-9][a-z0-9-_]{1,127}$/i.test(parsed)) {
    pushIssue(issueList, 'identifier_invalid', pathText, 'Identifiers must be slug-safe and 2-128 characters.')
    return null
  }
  return parsed
}

function hasPlaceholderMarker(text: string): string | null {
  const normalized = text.toLowerCase()
  for (const marker of PLACEHOLDER_MARKERS) {
    if (normalized.includes(marker)) return marker
  }
  return null
}

function isSafeRepositoryPath(value: string): boolean {
  if (path.isAbsolute(value)) return false
  if (value.includes('\0')) return false
  if (value.startsWith('.env')) return false
  const normalized = value.replace(/\\/g, '/')
  if (normalized.includes('../') || normalized.startsWith('../')) return false
  return /^[A-Za-z0-9._/-]+$/.test(normalized)
}

function validateSafeReference(
  value: string,
  issueList: ValidationIssue[],
  pathText: string,
): void {
  const marker = hasPlaceholderMarker(value)
  if (marker) {
    pushIssue(issueList, 'placeholder_marker', pathText, `Placeholder marker "${marker}" is not allowed.`)
  }

  if (value.startsWith('https://')) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:') {
        pushIssue(issueList, 'unsafe_url_protocol', pathText, 'Only https URLs are allowed.')
      }
    } catch {
      pushIssue(issueList, 'unsafe_url_invalid', pathText, 'URL is invalid.')
    }
    return
  }

  if (/^[a-z]+:/i.test(value)) {
    pushIssue(issueList, 'unsafe_url_protocol', pathText, 'Only https URLs or repository-relative references are allowed.')
    return
  }

  if (!isSafeRepositoryPath(value)) {
    pushIssue(issueList, 'unsafe_reference_path', pathText, 'Repository-relative references must stay inside the repository and avoid secret-like paths.')
  }
}

function validateDateString(value: string | null, issueList: ValidationIssue[], pathText: string): void {
  if (value === null) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    pushIssue(issueList, 'date_invalid', pathText, 'Expected YYYY-MM-DD date string.')
  }
}

function buildStats(packageData: ProgrammeContentPackage): ValidationStats {
  let lessonCount = 0
  let resourceCount = 0
  let draftCount = 0
  let approvedCount = 0
  let previewLessonCount = 0

  if (packageData.programme.status === 'draft') draftCount += 1
  if (packageData.programme.status === 'approved') approvedCount += 1

  for (const week of packageData.weeks) {
    if (week.status === 'draft') draftCount += 1
    if (week.status === 'approved') approvedCount += 1
    for (const lesson of week.lessons) {
      lessonCount += 1
      if (lesson.status === 'draft') draftCount += 1
      if (lesson.status === 'approved') approvedCount += 1
      if (lesson.previewAvailable) previewLessonCount += 1
      for (const resource of lesson.resources) {
        resourceCount += 1
        if (resource.status === 'draft') draftCount += 1
        if (resource.status === 'approved') approvedCount += 1
      }
    }
  }

  return {
    weekCount: packageData.weeks.length,
    lessonCount,
    resourceCount,
    draftCount,
    approvedCount,
    previewLessonCount,
  }
}

function stableJson<T>(value: T): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function checksumText(sourceText: string): string {
  return createHash('sha256').update(sourceText).digest('hex')
}

export function resolveProgrammeContentPath(inputPath: string): string {
  const trimmed = inputPath.trim()
  if (!trimmed) {
    throw new Error('A repository-relative programme content file path is required.')
  }
  if (path.isAbsolute(trimmed)) {
    throw new Error('Absolute input paths are not allowed. Use a repository-relative path.')
  }
  if (trimmed.includes('\0')) {
    throw new Error('Null bytes are not allowed in the input path.')
  }
  if (trimmed.startsWith('.env') || trimmed.includes('/.env') || trimmed.endsWith('.env')) {
    throw new Error('Environment files are not allowed as content input.')
  }
  const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'))
  if (normalized.startsWith('../') || normalized === '..') {
    throw new Error('Path traversal outside the repository is not allowed.')
  }
  if (path.extname(normalized) !== '.json') {
    throw new Error('Only .json programme content files are supported by this intake command.')
  }
  const resolved = path.resolve(REPOSITORY_ROOT, normalized)
  if (!resolved.startsWith(REPOSITORY_ROOT + path.sep) && resolved !== REPOSITORY_ROOT) {
    throw new Error('Resolved path escapes the repository root.')
  }
  if (!existsSync(resolved)) {
    throw new Error(`Content file not found: ${normalized}`)
  }
  const stats = statSync(resolved)
  if (!stats.isFile()) {
    throw new Error('Content input must be a regular file.')
  }
  const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.docx'])
  if (binaryExtensions.has(path.extname(resolved).toLowerCase())) {
    throw new Error('Binary files are not accepted as programme content input.')
  }
  return resolved
}

export function readProgrammeContentFile(inputPath: string): {
  inputPath: string
  resolvedPath: string
  sourceText: string
  packageData: ProgrammeContentPackage
} {
  const resolvedPath = resolveProgrammeContentPath(inputPath)
  const sourceText = readFileSync(resolvedPath, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(sourceText)
  } catch (error) {
    throw new Error(`Programme content file is not valid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`)
  }
  return {
    inputPath,
    resolvedPath,
    sourceText,
    packageData: parseProgrammeContentPackage(parsed),
  }
}

export function parseProgrammeContentPackage(input: unknown): ProgrammeContentPackage {
  const errors: ValidationIssue[] = []
  const root = requireObject(input, errors, 'package')
  if (!root) {
    throw new Error(formatIssues(errors))
  }

  hasAllowedKeys(root, ['packageFormat', 'packagePurpose', 'programme', 'weeks', 'approval'], errors, 'package')

  const packageFormat = requireString(root.packageFormat, errors, 'package.packageFormat')
  const packagePurpose = requireEnumValue(root.packagePurpose, PACKAGE_PURPOSES, errors, 'package.packagePurpose')
  const programmeObject = requireObject(root.programme, errors, 'package.programme')
  const approvalObject = requireObject(root.approval, errors, 'package.approval')

  if (!Array.isArray(root.weeks)) {
    pushIssue(errors, 'array_required', 'package.weeks', 'Expected weeks array.')
  }

  if (!programmeObject || !approvalObject || !packageFormat || !packagePurpose || !Array.isArray(root.weeks)) {
    throw new Error(formatIssues(errors))
  }

  hasAllowedKeys(
    programmeObject,
    ['id', 'title', 'shortSummary', 'longDescription', 'version', 'status', 'locale', 'weekCount', 'publicationIntent'],
    errors,
    'package.programme',
  )
  hasAllowedKeys(
    approvalObject,
    ['approvalStatus', 'approver', 'approvalDate', 'approvalReference', 'explicitClientApproval', 'publicationApproved', 'notes'],
    errors,
    'package.approval',
  )

  const packageData: ProgrammeContentPackage = {
    packageFormat: packageFormat as typeof PROGRAMME_CONTENT_FORMAT,
    packagePurpose,
    programme: {
      id: requireSafeIdentifier(programmeObject.id, errors, 'package.programme.id') ?? 'invalid-programme-id',
      title: requireString(programmeObject.title, errors, 'package.programme.title') ?? '',
      shortSummary: requireString(programmeObject.shortSummary, errors, 'package.programme.shortSummary') ?? '',
      longDescription: requireString(programmeObject.longDescription, errors, 'package.programme.longDescription') ?? '',
      version: requireString(programmeObject.version, errors, 'package.programme.version') ?? '',
      status: requireEnumValue(programmeObject.status, PROGRAMME_STATUSES, errors, 'package.programme.status') ?? 'draft',
      locale: requireString(programmeObject.locale, errors, 'package.programme.locale') ?? '',
      weekCount: requireNumber(programmeObject.weekCount, errors, 'package.programme.weekCount') ?? 0,
      publicationIntent:
        requireEnumValue(programmeObject.publicationIntent, PUBLICATION_INTENTS, errors, 'package.programme.publicationIntent') ??
        'preview_only',
    },
    weeks: root.weeks.map((entry, index) => parseWeek(entry, index, errors)),
    approval: {
      approvalStatus:
        requireEnumValue(approvalObject.approvalStatus, APPROVAL_STATUSES, errors, 'package.approval.approvalStatus') ??
        'not_approved',
      approver: requireNullableString(approvalObject.approver, errors, 'package.approval.approver'),
      approvalDate: requireNullableString(approvalObject.approvalDate, errors, 'package.approval.approvalDate'),
      approvalReference: requireNullableString(approvalObject.approvalReference, errors, 'package.approval.approvalReference'),
      explicitClientApproval:
        requireBoolean(approvalObject.explicitClientApproval, errors, 'package.approval.explicitClientApproval') ?? false,
      publicationApproved:
        requireBoolean(approvalObject.publicationApproved, errors, 'package.approval.publicationApproved') ?? false,
      notes: requireNullableString(approvalObject.notes, errors, 'package.approval.notes'),
    },
  }

  if (packageData.packageFormat !== PROGRAMME_CONTENT_FORMAT) {
    pushIssue(
      errors,
      'package_format_invalid',
      'package.packageFormat',
      `Expected package format ${PROGRAMME_CONTENT_FORMAT}.`,
    )
  }

  validateDateString(packageData.approval.approvalDate, errors, 'package.approval.approvalDate')

  if (errors.length > 0) {
    throw new Error(formatIssues(errors))
  }

  return packageData
}

function parseWeek(value: unknown, index: number, errors: ValidationIssue[]): ProgrammeWeek {
  const weekObject = requireObject(value, errors, `package.weeks[${index}]`)
  if (!weekObject) {
    return {
      id: `invalid-week-${index + 1}`,
      slug: `invalid-week-${index + 1}`,
      sequence: index + 1,
      title: '',
      summary: '',
      learningOutcomes: [],
      estimatedDuration: '',
      status: 'draft',
      lessons: [],
    }
  }

  hasAllowedKeys(
    weekObject,
    ['id', 'slug', 'sequence', 'title', 'summary', 'learningOutcomes', 'estimatedDuration', 'status', 'lessons'],
    errors,
    `package.weeks[${index}]`,
  )

  const lessons = Array.isArray(weekObject.lessons)
    ? weekObject.lessons.map((entry, lessonIndex) => parseLesson(entry, index, lessonIndex, errors))
    : (pushIssue(errors, 'array_required', `package.weeks[${index}].lessons`, 'Expected lessons array.'), [])

  return {
    id: requireSafeIdentifier(weekObject.id, errors, `package.weeks[${index}].id`) ?? `invalid-week-${index + 1}`,
    slug: requireSafeIdentifier(weekObject.slug, errors, `package.weeks[${index}].slug`) ?? `invalid-week-${index + 1}`,
    sequence: requireNumber(weekObject.sequence, errors, `package.weeks[${index}].sequence`) ?? index + 1,
    title: requireString(weekObject.title, errors, `package.weeks[${index}].title`) ?? '',
    summary: requireString(weekObject.summary, errors, `package.weeks[${index}].summary`) ?? '',
    learningOutcomes:
      requireStringArray(weekObject.learningOutcomes, errors, `package.weeks[${index}].learningOutcomes`) ?? [],
    estimatedDuration:
      requireString(weekObject.estimatedDuration, errors, `package.weeks[${index}].estimatedDuration`) ?? '',
    status:
      requireEnumValue(weekObject.status, WEEK_STATUSES, errors, `package.weeks[${index}].status`) ?? 'draft',
    lessons,
  }
}

function parseLesson(
  value: unknown,
  weekIndex: number,
  lessonIndex: number,
  errors: ValidationIssue[],
): ProgrammeLesson {
  const lessonObject = requireObject(value, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}]`)
  if (!lessonObject) {
    return {
      id: `invalid-lesson-${weekIndex + 1}-${lessonIndex + 1}`,
      slug: `invalid-lesson-${weekIndex + 1}-${lessonIndex + 1}`,
      sequence: lessonIndex + 1,
      title: '',
      summary: '',
      body: '',
      estimatedDuration: '',
      lessonType: 'reading',
      previewAvailable: false,
      videoReference: null,
      status: 'draft',
      resources: [],
    }
  }

  hasAllowedKeys(
    lessonObject,
    ['id', 'slug', 'sequence', 'title', 'summary', 'body', 'estimatedDuration', 'lessonType', 'previewAvailable', 'videoReference', 'status', 'resources'],
    errors,
    `package.weeks[${weekIndex}].lessons[${lessonIndex}]`,
  )

  const resources = Array.isArray(lessonObject.resources)
    ? lessonObject.resources.map((entry, resourceIndex) => parseResource(entry, weekIndex, lessonIndex, resourceIndex, errors))
    : (pushIssue(errors, 'array_required', `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources`, 'Expected resources array.'), [])

  return {
    id:
      requireSafeIdentifier(lessonObject.id, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}].id`) ??
      `invalid-lesson-${weekIndex + 1}-${lessonIndex + 1}`,
    slug:
      requireSafeIdentifier(lessonObject.slug, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}].slug`) ??
      `invalid-lesson-${weekIndex + 1}-${lessonIndex + 1}`,
    sequence:
      requireNumber(lessonObject.sequence, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}].sequence`) ??
      lessonIndex + 1,
    title: requireString(lessonObject.title, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}].title`) ?? '',
    summary:
      requireString(lessonObject.summary, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}].summary`) ?? '',
    body: requireString(lessonObject.body, errors, `package.weeks[${weekIndex}].lessons[${lessonIndex}].body`) ?? '',
    estimatedDuration:
      requireString(
        lessonObject.estimatedDuration,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].estimatedDuration`,
      ) ?? '',
    lessonType:
      requireEnumValue(
        lessonObject.lessonType,
        LESSON_TYPES,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].lessonType`,
      ) ?? 'reading',
    previewAvailable:
      requireBoolean(
        lessonObject.previewAvailable,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].previewAvailable`,
      ) ?? false,
    videoReference: requireNullableString(
      lessonObject.videoReference,
      errors,
      `package.weeks[${weekIndex}].lessons[${lessonIndex}].videoReference`,
    ),
    status:
      requireEnumValue(
        lessonObject.status,
        LESSON_STATUSES,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].status`,
      ) ?? 'draft',
    resources,
  }
}

function parseResource(
  value: unknown,
  weekIndex: number,
  lessonIndex: number,
  resourceIndex: number,
  errors: ValidationIssue[],
): ProgrammeResource {
  const resourceObject = requireObject(
    value,
    errors,
    `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}]`,
  )
  if (!resourceObject) {
    return {
      id: `invalid-resource-${weekIndex + 1}-${lessonIndex + 1}-${resourceIndex + 1}`,
      label: '',
      resourceType: 'download',
      source: '',
      accessibilityLabel: '',
      status: 'draft',
    }
  }

  hasAllowedKeys(
    resourceObject,
    ['id', 'label', 'resourceType', 'source', 'accessibilityLabel', 'status'],
    errors,
    `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}]`,
  )

  return {
    id:
      requireSafeIdentifier(
        resourceObject.id,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}].id`,
      ) ?? `invalid-resource-${weekIndex + 1}-${lessonIndex + 1}-${resourceIndex + 1}`,
    label:
      requireString(
        resourceObject.label,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}].label`,
      ) ?? '',
    resourceType:
      requireEnumValue(
        resourceObject.resourceType,
        RESOURCE_TYPES,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}].resourceType`,
      ) ?? 'download',
    source:
      requireString(
        resourceObject.source,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}].source`,
      ) ?? '',
    accessibilityLabel:
      requireString(
        resourceObject.accessibilityLabel,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}].accessibilityLabel`,
      ) ?? '',
    status:
      requireEnumValue(
        resourceObject.status,
        RESOURCE_STATUSES,
        errors,
        `package.weeks[${weekIndex}].lessons[${lessonIndex}].resources[${resourceIndex}].status`,
      ) ?? 'draft',
  }
}

export function validateProgrammeContentPackage(
  packageData: ProgrammeContentPackage,
  inputPath: string,
  resolvedPath: string,
  checksum: string,
): ProgrammeValidationResult {
  const errors: ValidationIssue[] = []
  const blockers: ValidationIssue[] = []

  const identifierScopes = {
    weekIds: new Set<string>(),
    weekSlugs: new Set<string>(),
    lessonIds: new Set<string>(),
    lessonSlugs: new Set<string>(),
    resourceIds: new Set<string>(),
  }

  const programmeMarkerFields = [
    ['package.programme.title', packageData.programme.title],
    ['package.programme.shortSummary', packageData.programme.shortSummary],
    ['package.programme.longDescription', packageData.programme.longDescription],
  ] as const

  for (const [pathText, value] of programmeMarkerFields) {
    const marker = hasPlaceholderMarker(value)
    if (marker) {
      pushIssue(blockers, 'placeholder_marker', pathText, `Placeholder marker "${marker}" blocks release eligibility.`)
    }
  }

  if (packageData.programme.weekCount !== REQUIRED_PROGRAMME_WEEK_COUNT) {
    pushIssue(
      errors,
      'week_count_invalid',
      'package.programme.weekCount',
      `Representative programme content must declare exactly ${REQUIRED_PROGRAMME_WEEK_COUNT} weeks.`,
    )
  }

  if (packageData.weeks.length !== REQUIRED_PROGRAMME_WEEK_COUNT) {
    pushIssue(
      errors,
      'week_array_count_invalid',
      'package.weeks',
      `Representative programme content must contain exactly ${REQUIRED_PROGRAMME_WEEK_COUNT} weeks.`,
    )
  }

  const weekSequences = new Set<number>()
  for (const week of packageData.weeks) {
    if (identifierScopes.weekIds.has(week.id)) {
      pushIssue(errors, 'duplicate_week_id', 'package.weeks', `Duplicate week id "${week.id}".`)
    }
    identifierScopes.weekIds.add(week.id)

    if (identifierScopes.weekSlugs.has(week.slug)) {
      pushIssue(errors, 'duplicate_week_slug', 'package.weeks', `Duplicate week slug "${week.slug}".`)
    }
    identifierScopes.weekSlugs.add(week.slug)

    if (weekSequences.has(week.sequence)) {
      pushIssue(errors, 'duplicate_week_sequence', 'package.weeks', `Duplicate week sequence "${week.sequence}".`)
    }
    weekSequences.add(week.sequence)

    const weekMarker = hasPlaceholderMarker(`${week.title} ${week.summary}`)
    if (weekMarker) {
      pushIssue(blockers, 'placeholder_marker', `week:${week.id}`, `Placeholder marker "${weekMarker}" blocks release eligibility.`)
    }

    if (!week.learningOutcomes.length) {
      pushIssue(errors, 'learning_outcomes_required', `week:${week.id}`, 'Each week must include at least one learning outcome.')
    }

    const lessonSequences = new Set<number>()
    for (const lesson of week.lessons) {
      if (identifierScopes.lessonIds.has(lesson.id)) {
        pushIssue(errors, 'duplicate_lesson_id', `week:${week.id}`, `Duplicate lesson id "${lesson.id}".`)
      }
      identifierScopes.lessonIds.add(lesson.id)

      if (identifierScopes.lessonSlugs.has(lesson.slug)) {
        pushIssue(errors, 'duplicate_lesson_slug', `week:${week.id}`, `Duplicate lesson slug "${lesson.slug}".`)
      }
      identifierScopes.lessonSlugs.add(lesson.slug)

      if (lessonSequences.has(lesson.sequence)) {
        pushIssue(errors, 'duplicate_lesson_sequence', `week:${week.id}`, `Duplicate lesson sequence "${lesson.sequence}" in week "${week.id}".`)
      }
      lessonSequences.add(lesson.sequence)

      const lessonMarker = hasPlaceholderMarker(`${lesson.title} ${lesson.summary} ${lesson.body}`)
      if (lessonMarker) {
        pushIssue(blockers, 'placeholder_marker', `lesson:${lesson.id}`, `Placeholder marker "${lessonMarker}" blocks release eligibility.`)
      }

      if (lesson.videoReference) {
        validateSafeReference(lesson.videoReference, errors, `lesson:${lesson.id}.videoReference`)
      }

      for (const resource of lesson.resources) {
        if (identifierScopes.resourceIds.has(resource.id)) {
          pushIssue(errors, 'duplicate_resource_id', `lesson:${lesson.id}`, `Duplicate resource id "${resource.id}".`)
        }
        identifierScopes.resourceIds.add(resource.id)

        validateSafeReference(resource.source, errors, `resource:${resource.id}.source`)

        const resourceMarker = hasPlaceholderMarker(`${resource.label} ${resource.accessibilityLabel}`)
        if (resourceMarker) {
          pushIssue(blockers, 'placeholder_marker', `resource:${resource.id}`, `Placeholder marker "${resourceMarker}" blocks release eligibility.`)
        }
      }
    }

    const expectedWeekLessonSequence = sequenceSet(week.lessons.map((lesson) => lesson.sequence))
    const actualLessonSequence = sequenceSet([...lessonSequences])
    if (!arrayEqual(expectedWeekLessonSequence, actualLessonSequence)) {
      pushIssue(
        errors,
        'lesson_sequence_gap',
        `week:${week.id}`,
        'Lesson sequences must be contiguous and start at 1 within each week.',
      )
    }
  }

  const expectedWeekSequence = sequenceSet(packageData.weeks.map((week) => week.sequence))
  const actualWeekSequence = sequenceSet([...weekSequences])
  if (!arrayEqual(expectedWeekSequence, actualWeekSequence)) {
    pushIssue(errors, 'week_sequence_gap', 'package.weeks', 'Week sequences must be contiguous and start at 1.')
  }

  if (packageData.packagePurpose === 'test_fixture') {
    pushIssue(
      blockers,
      'test_fixture_not_publishable',
      'package.packagePurpose',
      'Test fixtures are structurally valid but can never become release-eligible.',
    )
  }

  if (packageData.programme.publicationIntent !== 'approved_for_import') {
    pushIssue(
      blockers,
      'publication_intent_not_explicit',
      'package.programme.publicationIntent',
      'Release eligibility requires explicit publication intent "approved_for_import".',
    )
  }

  if (packageData.approval.approvalStatus !== 'approved') {
    pushIssue(blockers, 'approval_missing', 'package.approval.approvalStatus', 'Release eligibility requires approved content.')
  }

  if (!packageData.approval.explicitClientApproval) {
    pushIssue(
      blockers,
      'client_approval_missing',
      'package.approval.explicitClientApproval',
      'Explicit client approval is required for release eligibility.',
    )
  }

  if (!packageData.approval.publicationApproved) {
    pushIssue(
      blockers,
      'publication_approval_missing',
      'package.approval.publicationApproved',
      'Publication approval is required for release eligibility.',
    )
  }

  if (!packageData.approval.approvalReference) {
    pushIssue(
      blockers,
      'approval_reference_missing',
      'package.approval.approvalReference',
      'Approval evidence reference is required for release eligibility.',
    )
  } else {
    validateSafeReference(packageData.approval.approvalReference, errors, 'package.approval.approvalReference')
  }

  if (packageData.approval.approvalStatus === 'approved') {
    if (!packageData.approval.approver) {
      pushIssue(blockers, 'approver_missing', 'package.approval.approver', 'Approved content must record an approver.')
    }
    if (!packageData.approval.approvalDate) {
      pushIssue(blockers, 'approval_date_missing', 'package.approval.approvalDate', 'Approved content must record an approval date.')
    }
  }

  const structuralValid = errors.length === 0
  const releaseEligible = structuralValid && blockers.length === 0

  return {
    inputPath,
    resolvedPath,
    checksum,
    packageData,
    stats: buildStats(packageData),
    structuralValid,
    releaseEligible,
    errors,
    blockers,
  }
}

function sequenceSet(sequences: number[]): number[] {
  return [...new Set(sequences)].sort((a, b) => a - b)
}

function arrayEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export function loadAndValidateProgrammeContent(inputPath: string): ProgrammeValidationResult {
  const loaded = readProgrammeContentFile(inputPath)
  return validateProgrammeContentPackage(
    loaded.packageData,
    loaded.inputPath,
    loaded.resolvedPath,
    checksumText(loaded.sourceText),
  )
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`).join('\n')
}

export function buildProgrammeAcceptanceReportMarkdown(result: ProgrammeValidationResult): string {
  const { packageData, stats } = result
  const missingRequiredFields = [...result.errors].filter((issue) =>
    ['string_required', 'empty_string', 'array_required', 'array_empty', 'number_required', 'object_required'].includes(issue.code),
  )
  const placeholderFindings = [...result.errors, ...result.blockers].filter((issue) => issue.code === 'placeholder_marker')
  const unsafeUrlFindings = [...result.errors, ...result.blockers].filter((issue) =>
    issue.code.includes('unsafe') || issue.code.includes('reference_path'),
  )
  const accessibilityFindings = [
    ...result.errors.filter((issue) => issue.path.endsWith('.accessibilityLabel')),
    ...result.blockers.filter((issue) => issue.path.endsWith('.accessibilityLabel')),
  ]

  const lines = [
    '# Programme Content Acceptance Report',
    '',
    `- package path: \`${result.inputPath}\``,
    `- checksum: \`${result.checksum}\``,
    `- programme identifier: \`${packageData.programme.id}\``,
    `- programme version: \`${packageData.programme.version}\``,
    `- module/week count: ${stats.weekCount}`,
    `- lesson count: ${stats.lessonCount}`,
    `- resource count: ${stats.resourceCount}`,
    `- draft count: ${stats.draftCount}`,
    `- approved count: ${stats.approvedCount}`,
    `- preview lesson count: ${stats.previewLessonCount}`,
    `- structural validation: ${result.structuralValid ? 'passed' : 'failed'}`,
    `- release eligibility: ${result.releaseEligible ? 'eligible' : 'ineligible'}`,
    `- approval status: ${packageData.approval.approvalStatus}`,
    `- approval evidence: ${packageData.approval.approvalReference ?? 'missing'}`,
    '',
    '## Missing required fields',
    ...renderIssueList(missingRequiredFields),
    '',
    '## Placeholder marker findings',
    ...renderIssueList(placeholderFindings),
    '',
    '## Unsafe URL findings',
    ...renderIssueList(unsafeUrlFindings),
    '',
    '## Accessibility checklist findings',
    ...renderIssueList(accessibilityFindings),
    '',
    '## Exact blockers',
    ...renderIssueList(result.blockers.length ? result.blockers : result.errors),
  ]

  return lines.join('\n')
}

function renderIssueList(issues: ValidationIssue[]): string[] {
  if (issues.length === 0) return ['- none']
  return issues.map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`)
}

type RepositoryModel = {
  courseSlugs: Set<string>
  moduleKeys: Set<string>
  lessonSlugs: Set<string>
}

function getRepositoryModel(): RepositoryModel {
  const model: RepositoryModel = {
    courseSlugs: new Set<string>(),
    moduleKeys: new Set<string>(),
    lessonSlugs: new Set<string>(),
  }

  for (const course of courseSeeds) {
    model.courseSlugs.add(course.slug)
    for (const module of course.modules) {
      model.moduleKeys.add(`${course.slug}:${module.title.toLowerCase()}`)
      for (const lesson of module.lessons) {
        model.lessonSlugs.add(lesson.slug)
      }
    }
  }

  return model
}

export function buildProgrammeImportPlan(result: ProgrammeValidationResult): ProgrammeImportPlan {
  const model = getRepositoryModel()
  const operations: ImportPlanOperation[] = []
  const unresolvedReferences = new Set<string>()
  const resourceDependencies = new Set<string>()
  const publicationChanges = new Set<string>()
  const entitlementImplications = new Set<string>()
  const destructiveOperationWarnings = new Set<string>()

  const courseAction = model.courseSlugs.has(result.packageData.programme.id) ? 'update' : 'create'
  operations.push({
    kind: 'programme',
    action: courseAction,
    id: result.packageData.programme.id,
    targetKey: `payload_courses:${result.packageData.programme.id}`,
    detail:
      courseAction === 'create'
        ? 'No matching repository seed course exists; import would create a new Payload course.'
        : 'Matching repository seed course exists; import would review an update.',
  })

  entitlementImplications.add('Programme content targets controlled Free and Pro access states only.')
  if (result.stats.previewLessonCount > 0) {
    entitlementImplications.add(`Preview lessons declared: ${result.stats.previewLessonCount}. Preview access rules must stay explicit during any later import.`)
  }

  for (const week of result.packageData.weeks) {
    const moduleKey = `${result.packageData.programme.id}:${week.title.toLowerCase()}`
    const moduleAction = model.moduleKeys.has(moduleKey) ? 'update' : 'create'
    operations.push({
      kind: 'week',
      action: moduleAction,
      id: week.id,
      targetKey: `payload_course_modules:${moduleKey}`,
      detail:
        moduleAction === 'create'
          ? 'No matching repository seed module exists for this programme/week.'
          : 'Matching repository seed module title exists; import would review an update.',
    })

    if (week.status === 'approved') {
      publicationChanges.add(`Week ${week.sequence} (${week.title}) would be eligible for publication review.`)
    } else {
      publicationChanges.add(`Week ${week.sequence} (${week.title}) remains non-published until approval/import.`)
    }

    for (const lesson of week.lessons) {
      const lessonAction = model.lessonSlugs.has(lesson.slug) ? 'update' : 'create'
      operations.push({
        kind: 'lesson',
        action: lessonAction,
        id: lesson.id,
        targetKey: `payload_lessons:${lesson.slug}`,
        detail:
          lessonAction === 'create'
            ? 'No matching repository seed lesson slug exists.'
            : 'Matching repository seed lesson slug exists; import would review an update.',
      })

      if (lesson.previewAvailable) {
        publicationChanges.add(`Lesson ${lesson.slug} declares preview availability.`)
      }

      for (const resource of lesson.resources) {
        operations.push({
          kind: 'resource',
          action: 'create',
          id: resource.id,
          targetKey: `payload_lesson_resources:${resource.id}`,
          detail: 'Repository seed data does not include a stable resource projection for this item; import would create or map it.',
        })

        if (resource.source.startsWith('https://')) {
          resourceDependencies.add(`External resource dependency: ${resource.source}`)
        } else if (isSafeRepositoryPath(resource.source)) {
          const absolutePath = path.resolve(REPOSITORY_ROOT, resource.source)
          if (!existsSync(absolutePath)) {
            unresolvedReferences.add(`Missing repository resource reference: ${resource.source}`)
          } else {
            resourceDependencies.add(`Repository resource dependency: ${resource.source}`)
          }
        }
      }
    }
  }

  if (!result.releaseEligible) {
    destructiveOperationWarnings.add('Import is blocked because the package is not release-eligible.')
  }

  if (courseAction === 'update' && result.packageData.weeks.length < REQUIRED_PROGRAMME_WEEK_COUNT) {
    destructiveOperationWarnings.add('Incoming package defines fewer weeks than the required representative programme contract.')
  }

  return {
    packagePath: result.inputPath,
    checksum: result.checksum,
    structuralValid: result.structuralValid,
    releaseEligible: result.releaseEligible,
    operations,
    unresolvedReferences: [...unresolvedReferences].sort(),
    resourceDependencies: [...resourceDependencies].sort(),
    publicationChanges: [...publicationChanges].sort(),
    entitlementImplications: [...entitlementImplications].sort(),
    destructiveOperationWarnings: [...destructiveOperationWarnings].sort(),
    blockers: [...result.errors, ...result.blockers],
  }
}

export function buildProgrammeImportPlanMarkdown(plan: ProgrammeImportPlan): string {
  const byAction = {
    create: plan.operations.filter((entry) => entry.action === 'create'),
    update: plan.operations.filter((entry) => entry.action === 'update'),
    unchanged: plan.operations.filter((entry) => entry.action === 'unchanged'),
    archive_or_defer: plan.operations.filter((entry) => entry.action === 'archive_or_defer'),
  }

  return [
    '# Programme Content Import Plan',
    '',
    `- package path: \`${plan.packagePath}\``,
    `- checksum: \`${plan.checksum}\``,
    `- structural validation: ${plan.structuralValid ? 'passed' : 'failed'}`,
    `- release eligibility: ${plan.releaseEligible ? 'eligible' : 'ineligible'}`,
    '',
    '## Operations',
    `- create: ${byAction.create.length}`,
    `- update: ${byAction.update.length}`,
    `- unchanged: ${byAction.unchanged.length}`,
    `- archive/defer: ${byAction.archive_or_defer.length}`,
    '',
    ...renderOperations('Create', byAction.create),
    ...renderOperations('Update', byAction.update),
    ...renderOperations('Unchanged', byAction.unchanged),
    ...renderOperations('Archive or Defer', byAction.archive_or_defer),
    '',
    '## Unresolved references',
    ...renderStrings(plan.unresolvedReferences),
    '',
    '## Resource dependencies',
    ...renderStrings(plan.resourceDependencies),
    '',
    '## Publication changes',
    ...renderStrings(plan.publicationChanges),
    '',
    '## Entitlement implications',
    ...renderStrings(plan.entitlementImplications),
    '',
    '## Destructive operation warnings',
    ...renderStrings(plan.destructiveOperationWarnings),
  ].join('\n')
}

function renderOperations(title: string, items: ImportPlanOperation[]): string[] {
  const lines = [`### ${title}`]
  if (items.length === 0) {
    lines.push('- none')
    return lines
  }
  for (const item of items) {
    lines.push(`- [${item.kind}] ${item.id} -> ${item.targetKey}: ${item.detail}`)
  }
  return lines
}

function renderStrings(values: string[]): string[] {
  return values.length === 0 ? ['- none'] : values.map((value) => `- ${value}`)
}

export function assertProgrammeContractInvariant(): void {
  assert.equal(PROGRAMME_CONTENT_FORMAT, 'jpv-programme-content.v1')
  assert.equal(REQUIRED_PROGRAMME_WEEK_COUNT, 8)
}

export function stablePackageJson(packageData: ProgrammeContentPackage): string {
  return stableJson(packageData)
}
