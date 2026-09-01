import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import {
  evaluatePayloadCourseAccess,
  evaluatePayloadLessonAccess,
  type PayloadCourseAccessAPI,
  type PayloadDocument,
  type PayloadId,
  type PayloadCourseWriteAPI,
} from '@/lib/payloadCourse/accessService'
import {
  listPublishedLessonResources,
  type MemberLessonResource,
} from '@/lib/payloadCourse/lessonResources'
import {
  resolveMemberLessonManagedVideo,
  resolveMemberMediaAsset,
  type MemberManagedVideo,
  type MemberMediaAsset,
} from '@/lib/payloadContent/memberMedia'
import { relationshipId } from '@/lib/domain/relationships'
import { decodeHtmlEntities, isHiddenLegacyWelcomeLesson } from '@/lib/payloadCourse/curriculum'
import { getPayloadMigrationSchemaSqlPrefix } from '@/lib/payloadMigrationSchema'

export type LessonLockState = 'available' | 'locked' | 'coming_soon'

export type MemberPortalLesson = {
  id: string
  title: string
  slug: string | null
  summary: string | null
  coverImage: MemberMediaAsset | null
  estimatedDuration: string | null
  previewLesson: boolean
  lockState: LessonLockState
  completed: boolean
}

export type MemberPortalModule = {
  id: string
  title: string
  description: string | null
  lessons: MemberPortalLesson[]
}

export type MemberPortalLessonNavigation = {
  id: string
  title: string
  lessons: Array<{
    id: string
    title: string
    slug: string | null
    completed: boolean
  }>
}

export type MemberPortalCourse = {
  id: string
  title: string
  slug: string | null
  shortDescription: string | null
  description: string | null
  coverImage: MemberMediaAsset | null
  accessBadge: string | null
  estimatedDuration: string | null
  allowed: boolean
  decisionReason: string
  lockReason: string | null
  lessonCount: number | null
  completedLessonCount: number | null
  progressPercent: number | null
  modules: MemberPortalModule[]
}

export type MemberPortalContinueLesson = {
  courseTitle: string
  courseSlug: string | null
  lessonTitle: string
  lessonSlug: string | null
  estimatedDuration: string | null
} | null

export type MemberCourseDashboard = {
  memberId: string
  courses: MemberPortalCourse[]
  continueLesson: MemberPortalContinueLesson
}

export type MemberPortalLessonDetail = {
  course: {
    id: string
    title: string
    slug: string | null
  }
  module: {
    id: string
    title: string
  }
  lesson: {
    id: string
    title: string | null
    slug: string | null
    summary: string | null
    coverImage: MemberMediaAsset | null
    managedVideo: MemberManagedVideo | null
    estimatedDuration: string | null
    previewLesson: boolean
    lockState: LessonLockState
    videoProviderLabel: string | null
    videoIdOrPreviewUrl: string | null
    contentLexical: SerializedEditorState | null
    resources: MemberLessonResource[]
    completed: boolean
  } | null
  allowed: boolean
  decisionReason: string
  lockReason: string | null
  previousLesson: {
    title: string
    slug: string | null
    completed: boolean
  } | null
  nextLesson: {
    title: string
    slug: string | null
  } | null
  courseNavigation: MemberPortalLessonNavigation[]
}

export type MemberAccountOverview = {
  profile: {
    id: string
    displayName: string | null
    timezone: string | null
    phone: string | null
    company: string | null
    website: string | null
    biography: string | null
    socialLinks: {
      instagram: string | null
      twitter: string | null
      linkedin: string | null
      facebook: string | null
      youtube: string | null
    }
    coverImage: MemberMediaAsset | null
  } | null
  billingAccount: {
    billingStatus: string | null
    stripeMode: string | null
    updatedAt: string | null
  } | null
  subscriptions: {
    id: string
    plan: string | null
    status: string | null
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
  }[]
  groups: {
    id: string
    name: string
    slug: string | null
  }[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return decodeHtmlEntities(value.trim())
  if (typeof value === 'number') return String(value)
  return null
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asLockState(value: unknown): LessonLockState {
  if (value === 'locked' || value === 'coming_soon') return value
  return 'available'
}

function asLexicalContent(value: unknown): SerializedEditorState | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const root = record.root
  if (!root || typeof root !== 'object') return null
  const children = (root as Record<string, unknown>).children
  if (!Array.isArray(children) || children.length === 0) return null
  return value as SerializedEditorState
}

function lexicalPlainText(value: unknown): string | null {
  const lexical = asLexicalContent(value)
  if (!lexical) return null

  function collect(node: unknown): string {
    if (!node || typeof node !== 'object') return ''
    const record = node as Record<string, unknown>
    const text = typeof record.text === 'string' ? record.text : ''
    const children = Array.isArray(record.children)
      ? record.children.map(collect).filter(Boolean).join(record.type === 'root' ? '\n\n' : '')
      : ''
    return text || children
  }

  const normalized = collect(lexical.root).replace(/\n{3,}/g, '\n\n').trim()
  return normalized || null
}

function asDateString(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  return asString(value)
}

function getRelationshipIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(relationshipId).filter((id): id is string => Boolean(id))
  }

  const id = relationshipId(value)
  return id ? [id] : []
}

function bySortOrder(a: PayloadDocument, b: PayloadDocument): number {
  const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 0
  const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 0
  if (aOrder !== bOrder) return aOrder - bOrder
  return String(a.title ?? '').localeCompare(String(b.title ?? ''))
}

function courseMetadata(course: PayloadDocument) {
  return {
    id: String(course.id),
    title: asString(course.title) ?? 'Untitled course',
    slug: asString(course.slug),
    shortDescription: asString(course.shortDescription),
    description: lexicalPlainText(course.description),
    accessBadge: asString(course.accessBadge),
    estimatedDuration: asString(course.estimatedDuration),
  }
}

function lockReason(reason: string): string {
  switch (reason) {
    case 'authentication_required':
      return 'Sign in to view this course.'
    case 'account_not_active':
      return 'Your account is not active for this content.'
    case 'billing_not_active':
      return 'Billing must be active before this course unlocks.'
    case 'email_not_verified':
      return 'Verify your email before opening this course.'
    case 'policy_not_active':
      return 'This course is not currently open for access.'
    case 'no_matching_entitlement':
      return 'Your account does not currently include this course.'
    case 'content_not_published':
      return 'This course is not published.'
    default:
      return 'This course is locked for your account.'
  }
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  args: {
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  } = {}
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where: args.where,
    limit: args.limit ?? 100,
    depth: 0,
    sort: args.sort,
    overrideAccess: true,
  })

  return result.docs
}

async function findOne(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where: Record<string, unknown>,
  sort?: string
): Promise<PayloadDocument | null> {
  const docs = await findAll(payload, collection, { where, limit: 1, sort })
  return docs[0] ?? null
}

async function getCompletedLessonIds(
  payload: PayloadCourseAccessAPI,
  memberId: string
): Promise<Set<string>> {
  const progress = await findAll(payload, 'payload_lesson_progress', {
    where: {
      and: [
        { member: { equals: memberId } },
        { status: { equals: 'completed' } },
      ],
    },
    limit: 500,
  })

  return new Set(progress.map((doc) => relationshipId(doc.lesson)).filter((id): id is string => Boolean(id)))
}

async function getAllowedCourseModules(
  payload: PayloadCourseAccessAPI,
  courseId: PayloadId,
  completedLessonIds: Set<string>,
  courseSlug?: string | null,
): Promise<MemberPortalModule[]> {
  const modules = await findAll(payload, 'payload_course_modules', {
    where: {
      and: [
        { course: { equals: String(courseId) } },
        { publishedPreview: { equals: true } },
      ],
    },
    sort: 'sortOrder',
    limit: 100,
  })

  return Promise.all(
    modules.sort(bySortOrder).map(async (module) => {
      const lessons = await findAll(payload, 'payload_lessons', {
        where: {
          module: { equals: String(module.id) },
        },
        sort: 'sortOrder',
        limit: 200,
      })

      const lessonProjections = await Promise.all(
        lessons
          .sort(bySortOrder)
          .filter((lesson) => !isHiddenLegacyWelcomeLesson({
            courseSlug,
            moduleTitle: asString(module.title),
            lessonSlug: asString(lesson.slug),
            lessonTitle: asString(lesson.title),
          }))
          .map(async (lesson) => ({
            id: String(lesson.id),
            title: asString(lesson.title) ?? 'Untitled lesson',
            slug: asString(lesson.slug),
            summary: asString(lesson.summary),
            coverImage: await resolveMemberMediaAsset(payload, lesson.coverImage),
            estimatedDuration: asString(lesson.estimatedDuration),
            previewLesson: asBoolean(lesson.previewLesson),
            lockState: asLockState(lesson.lockState),
            completed: completedLessonIds.has(String(lesson.id)),
          }))
      )

      return {
        id: String(module.id),
        title: asString(module.title) ?? 'Untitled module',
        description: asString(module.description),
        lessons: lessonProjections,
      }
    })
  )
}

async function getCourseSequence(
  payload: PayloadCourseAccessAPI,
  courseId: PayloadId,
  courseSlug?: string | null,
): Promise<Array<{ module: PayloadDocument; lesson: PayloadDocument }>> {
  const modules = await findAll(payload, 'payload_course_modules', {
    where: {
      course: { equals: String(courseId) },
    },
    sort: 'sortOrder',
    limit: 100,
  })

  const moduleWithLessons = await Promise.all(
    modules.sort(bySortOrder).map(async (module) => {
      const lessons = await findAll(payload, 'payload_lessons', {
        where: {
          module: { equals: String(module.id) },
        },
        sort: 'sortOrder',
        limit: 200,
      })
      return { module, lessons }
    })
  )

  return moduleWithLessons.flatMap(({ module, lessons }) =>
    lessons
      .sort(bySortOrder)
      .filter((lesson) => !isHiddenLegacyWelcomeLesson({
        courseSlug,
        moduleTitle: asString(module.title),
        lessonSlug: asString(lesson.slug),
        lessonTitle: asString(lesson.title),
      }))
      .map((lesson) => ({ module, lesson }))
  )
}

function buildLessonNavigation(
  sequence: Array<{ module: PayloadDocument; lesson: PayloadDocument }>,
  completedLessonIds: Set<string>,
): MemberPortalLessonNavigation[] {
  const modules: MemberPortalLessonNavigation[] = []

  for (const entry of sequence) {
    const moduleId = String(entry.module.id)
    let module = modules.find((item) => item.id === moduleId)
    if (!module) {
      module = {
        id: moduleId,
        title: asString(entry.module.title) ?? 'Untitled module',
        lessons: [],
      }
      modules.push(module)
    }

    module.lessons.push({
      id: String(entry.lesson.id),
      title: asString(entry.lesson.title) ?? 'Untitled lesson',
      slug: asString(entry.lesson.slug),
      completed: completedLessonIds.has(String(entry.lesson.id)),
    })
  }

  return modules
}

async function buildCourseProjection(
  payload: PayloadCourseAccessAPI,
  args: {
    course: PayloadDocument
    allowed: boolean
    decisionReason: string
    modules: MemberPortalModule[]
  },
): Promise<MemberPortalCourse> {
  const lessonCount = args.allowed
    ? args.modules.reduce((count, module) => count + module.lessons.length, 0)
    : null
  const completedLessonCount = args.allowed
    ? args.modules.reduce(
        (count, module) => count + module.lessons.filter((lesson) => lesson.completed).length,
        0
      )
    : null
  const progressPercent =
    args.allowed && lessonCount && completedLessonCount !== null
      ? Math.round((completedLessonCount / lessonCount) * 100)
      : args.allowed
        ? 0
        : null
  const metadata = courseMetadata(args.course)
  const coverImage = await resolveMemberMediaAsset(payload, args.course.coverImage)

  return {
    ...metadata,
    coverImage,
    allowed: args.allowed,
    decisionReason: args.decisionReason,
    lockReason: args.allowed ? null : lockReason(args.decisionReason),
    lessonCount,
    completedLessonCount,
    progressPercent,
    modules: args.modules,
  }
}

function findContinueLesson(courses: MemberPortalCourse[]): MemberPortalContinueLesson {
  for (const course of courses) {
    if (!course.allowed) continue
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        if (!lesson.completed) {
          return {
            courseTitle: course.title,
            courseSlug: course.slug,
            lessonTitle: lesson.title,
            lessonSlug: lesson.slug,
            estimatedDuration: lesson.estimatedDuration,
          }
        }
      }
    }
  }

  return null
}

export async function getMemberCourseDashboard(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId
): Promise<MemberCourseDashboard> {
  const normalizedMemberId = String(memberId)
  const [courses, completedLessonIds] = await Promise.all([
    findAll(payload, 'payload_courses', {
      where: {
        status: { equals: 'published' },
      },
      sort: 'sortOrder',
      limit: 100,
    }),
    getCompletedLessonIds(payload, normalizedMemberId),
  ])

  const dashboardCourses = await Promise.all(
    courses.sort(bySortOrder).map(async (course) => {
      const access = await evaluatePayloadCourseAccess(payload, {
        memberId: normalizedMemberId,
        courseId: course.id,
      })
      const allowed = access.decision.allowed
      const modules = allowed
        ? await getAllowedCourseModules(payload, course.id, completedLessonIds, asString(course.slug))
        : []
      return buildCourseProjection(payload, {
        course,
        allowed,
        decisionReason: access.decision.reason,
        modules,
      })
    })
  )

  return {
    memberId: normalizedMemberId,
    courses: dashboardCourses,
    continueLesson: findContinueLesson(dashboardCourses),
  }
}

export async function getMemberCourseOverview(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  courseSlug: string
): Promise<MemberPortalCourse | null> {
  const normalizedMemberId = String(memberId)
  const course = await findOne(payload, 'payload_courses', {
    and: [
      { slug: { equals: courseSlug } },
      { status: { equals: 'published' } },
    ],
  })

  if (!course) return null

  const [access, completedLessonIds] = await Promise.all([
    evaluatePayloadCourseAccess(payload, {
      memberId: normalizedMemberId,
      courseId: course.id,
    }),
    getCompletedLessonIds(payload, normalizedMemberId),
  ])
  const allowed = access.decision.allowed
  const modules = allowed
    ? await getAllowedCourseModules(payload, course.id, completedLessonIds, asString(course.slug))
    : []

  return buildCourseProjection(payload, {
    course,
    allowed,
    decisionReason: access.decision.reason,
    modules,
  })
}

export async function getMemberLessonDetail(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  courseSlug: string,
  lessonSlug: string
): Promise<MemberPortalLessonDetail | null> {
  const normalizedMemberId = String(memberId)
  const lesson = await findOne(payload, 'payload_lessons', {
    slug: { equals: lessonSlug },
  })
  if (!lesson) return null

  const moduleId = relationshipId(lesson.module)
  const module = await findOne(payload, 'payload_course_modules', {
    id: { equals: moduleId },
  })
  const courseId = relationshipId(module?.course)
  const course = await findOne(payload, 'payload_courses', {
    and: [
      { id: { equals: courseId } },
      { status: { equals: 'published' } },
      { slug: { equals: courseSlug } },
    ],
  })

  if (!module || !course) return null

  if (isHiddenLegacyWelcomeLesson({
    courseSlug: asString(course.slug),
    moduleTitle: asString(module.title),
    lessonSlug: asString(lesson.slug),
    lessonTitle: asString(lesson.title),
  })) return null

  const [completedLessonIds, sequence] = await Promise.all([
    getCompletedLessonIds(payload, normalizedMemberId),
    getCourseSequence(payload, course.id, courseSlug),
  ])
  const index = sequence.findIndex((entry) => String(entry.lesson.id) === String(lesson.id))
  const previous = index > 0 ? sequence[index - 1] : null
  const next = index >= 0 ? sequence[index + 1] ?? null : null
  const courseNavigation = buildLessonNavigation(sequence, completedLessonIds)
  const access = await evaluatePayloadLessonAccess(payload, {
    memberId: normalizedMemberId,
    lessonId: lesson.id,
    requiresPreviousCompletion: false,
    previousLessonId: previous?.lesson.id ?? null,
  })
  const allowed = access.decision.allowed
  const lessonTitle = asString(lesson.title) ?? 'Untitled lesson'
  const [resources, coverImage, managedVideo] = await Promise.all([
    allowed ? listPublishedLessonResources(payload, lesson.id) : Promise.resolve([]),
    allowed ? resolveMemberMediaAsset(payload, lesson.coverImage) : Promise.resolve(null),
    allowed ? resolveMemberLessonManagedVideo(payload, lesson) : Promise.resolve(null),
  ])

  return {
    course: {
      id: String(course.id),
      title: asString(course.title) ?? 'Untitled course',
      slug: asString(course.slug),
    },
    module: {
      id: String(module.id),
      title: asString(module.title) ?? 'Untitled module',
    },
    lesson: allowed
      ? {
          id: String(lesson.id),
          title: lessonTitle,
          slug: asString(lesson.slug),
          summary: asString(lesson.summary),
          coverImage,
          managedVideo,
          estimatedDuration: asString(lesson.estimatedDuration),
          previewLesson: asBoolean(lesson.previewLesson),
          lockState: asLockState(lesson.lockState),
          videoProviderLabel: asString(lesson.videoProviderLabel),
          videoIdOrPreviewUrl: asString(lesson.videoIdOrPreviewUrl),
          contentLexical: asLexicalContent(lesson.content),
          resources,
          completed: completedLessonIds.has(String(lesson.id)),
        }
      : {
          id: String(lesson.id),
          title: null,
          slug: asString(lesson.slug),
          summary: null,
          coverImage: null,
          managedVideo: null,
          estimatedDuration: null,
          previewLesson: false,
          lockState: 'available' as LessonLockState,
          videoProviderLabel: null,
          videoIdOrPreviewUrl: null,
          contentLexical: null,
          resources: [],
          completed: false,
        },
    allowed,
    decisionReason: access.decision.reason,
    lockReason: allowed ? null : lockReason(access.decision.reason),
    previousLesson: previous
      ? {
          title: asString(previous.lesson.title) ?? 'Previous lesson',
          slug: asString(previous.lesson.slug),
          completed: completedLessonIds.has(String(previous.lesson.id)),
        }
      : null,
    nextLesson: allowed && next
      ? {
          title: asString(next.lesson.title) ?? 'Next lesson',
          slug: asString(next.lesson.slug),
        }
      : null,
    courseNavigation,
  }
}

function numericPayloadId(value: PayloadId): number | null {
  const normalized = String(value)
  if (!/^\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function lessonProgressDocumentFromRow(row: Record<string, unknown>): PayloadDocument {
  return {
    id: row.id as PayloadId,
    displayName: row.display_name,
    member: row.member_id as PayloadId,
    lesson: row.lesson_id as PayloadId,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    percentComplete: row.percent_complete,
    lastPositionSeconds: row.last_position_seconds,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function markMemberLessonCompleteWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  lessonId: PayloadId,
  lessonTitle: string,
  completedAt: string,
): Promise<PayloadDocument | null> {
  const pool = payload.db?.pool
  const member = numericPayloadId(memberId)
  const lesson = numericPayloadId(lessonId)
  if (!pool || member === null || lesson === null) return null

  const schema = getPayloadMigrationSchemaSqlPrefix()
  try {
    const result = await pool.query({
      text: `INSERT INTO ${schema}."payload_lesson_progress" AS progress ("display_name", "member_id", "lesson_id", "status", "percent_complete", "completed_at", "started_at") VALUES ($1, $2, $3, 'completed', 100, $4, $4) ON CONFLICT ("member_id", "lesson_id") DO UPDATE SET "display_name" = EXCLUDED."display_name", "status" = EXCLUDED."status", "percent_complete" = EXCLUDED."percent_complete", "completed_at" = EXCLUDED."completed_at", "started_at" = COALESCE(progress."started_at", EXCLUDED."started_at"), "updated_at" = now() RETURNING "id", "display_name", "member_id", "lesson_id", "status", "started_at", "completed_at", "percent_complete", "last_position_seconds", "metadata", "created_at", "updated_at"`,
      values: [`${String(memberId)}:${lessonTitle}`, member, lesson, completedAt],
      statement_timeout: 3000,
    })
    const row = result.rows[0]
    return row ? lessonProgressDocumentFromRow(row) : null
  } catch (error) {
    console.error('JPV_LESSON_PROGRESS_SQL_FALLBACK_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function markMemberLessonComplete(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  lessonId: PayloadId,
  lessonTitle: string
): Promise<PayloadDocument> {
  const normalizedMemberId = String(memberId)
  const normalizedLessonId = String(lessonId)
  const completedAt = new Date().toISOString()

  // Production has legacy Payload rows whose relationship adapter rejects
  // valid numeric member/lesson IDs during this write. Use the existing
  // schema-qualified pool only when both IDs are safe integers; the Payload
  // adapter remains the fallback for tests and non-numeric installations.
  const persistedWithPool = await markMemberLessonCompleteWithPool(
    payload,
    memberId,
    lessonId,
    lessonTitle,
    completedAt,
  )
  if (persistedWithPool) return persistedWithPool
  const progressWhere = {
    and: [
      { member: { equals: normalizedMemberId } },
      { lesson: { equals: normalizedLessonId } },
    ],
  }

  // Read existing record first (optimistic path — no DB write if already complete).
  const existing = await findOne(payload, 'payload_lesson_progress', progressWhere)

  const data = {
    displayName: `${normalizedMemberId}:${lessonTitle}`,
    member: normalizedMemberId,
    lesson: normalizedLessonId,
    status: 'completed',
    percentComplete: 100,
    completedAt,
    startedAt: existing?.startedAt ?? completedAt,
  }

  if (existing) {
    return payload.update({
      collection: 'payload_lesson_progress',
      id: existing.id,
      data,
      overrideAccess: true,
    })
  }

  // Attempt to create. The unique constraint on (member_id, lesson_id) prevents
  // duplicates if a concurrent request wins the race. On that collision, fall
  // back to a re-read and update instead of propagating a DB error.
  try {
    return await payload.create({
      collection: 'payload_lesson_progress',
      data,
      overrideAccess: true,
    })
  } catch (createErr: unknown) {
    const message =
      createErr instanceof Error ? createErr.message : String(createErr)
    const isUniqueViolation =
      message.includes('unique') ||
      message.includes('duplicate') ||
      message.includes('payload_lesson_progress_member_lesson_unique')

    if (!isUniqueViolation) throw createErr

    // Another request created the row concurrently — update it.
    const raceWinner = await findOne(payload, 'payload_lesson_progress', progressWhere)
    if (!raceWinner) throw createErr

    return payload.update({
      collection: 'payload_lesson_progress',
      id: raceWinner.id,
      data,
      overrideAccess: true,
    })
  }
}

export type MemberBillingOverview = {
  billingAccount: {
    billingStatus: string | null
    stripeMode: string | null
    updatedAt: string | null
  } | null
  subscription: {
    id: string
    plan: string | null
    status: string | null
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
  } | null
  hasPaidSubscription: boolean
  plan: string | null
  billingStatus: string | null
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export async function getMemberBillingOverview(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId
): Promise<MemberBillingOverview> {
  const normalizedMemberId = String(memberId)
  const [billingAccount, subscriptions] = await Promise.all([
    findOne(
      payload,
      'payload_billing_accounts',
      { member: { equals: normalizedMemberId } },
      '-updatedAt'
    ),
    findAll(payload, 'payload_subscriptions', {
      where: {
        member: { equals: normalizedMemberId },
      },
      sort: '-updatedAt',
      limit: 25,
    }),
  ])

  const normalizedSubscriptions = subscriptions.map((subscription) => ({
    id: String(subscription.id),
    plan: asString(subscription.plan),
    status: asString(subscription.status),
    cancelAtPeriodEnd: asBoolean(subscription.cancelAtPeriodEnd),
    currentPeriodEnd: asDateString(subscription.currentPeriodEnd),
  }))
  const subscription =
    normalizedSubscriptions.find(
      (candidate) => candidate.plan !== null && candidate.status !== 'incomplete_expired'
    ) ??
    normalizedSubscriptions.find(
      (candidate) => candidate.plan !== null
    ) ??
    null
  const hasPaidSubscription = Boolean(subscription)

  return {
    billingAccount: billingAccount
      ? {
          billingStatus: asString(billingAccount.billingStatus),
          stripeMode: asString(billingAccount.stripeMode),
          updatedAt: asDateString(billingAccount.updatedAt),
        }
      : null,
    subscription,
    hasPaidSubscription,
    plan: subscription?.plan ?? null,
    billingStatus: asString(billingAccount?.billingStatus),
    subscriptionStatus: subscription?.status ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
  }
}

export async function getMemberAccountOverview(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId
): Promise<MemberAccountOverview> {
  const normalizedMemberId = String(memberId)
  const [profile, billingAccount, subscriptions, groups] = await Promise.all([
    findOne(payload, 'payload_member_profiles', {
      member: { equals: normalizedMemberId },
    }),
    findOne(
      payload,
      'payload_billing_accounts',
      { member: { equals: normalizedMemberId } },
      '-updatedAt'
    ),
    findAll(payload, 'payload_subscriptions', {
      where: {
        member: { equals: normalizedMemberId },
      },
      sort: '-updatedAt',
      limit: 25,
    }),
    findAll(payload, 'payload_access_groups', {
      where: {
        status: { equals: 'active' },
      },
      sort: 'name',
      limit: 200,
    }),
  ])

  const profileCoverImage = profile
    ? await resolveMemberMediaAsset(payload, profile.coverImage)
    : null

  return {
    profile: profile
      ? {
          id: String(profile.id),
          displayName: asString(profile.displayName),
          timezone: asString(profile.timezone),
          phone: asString(profile.phone),
          company: asString(profile.company),
          website: asString(profile.website),
          biography: lexicalPlainText(profile.biography),
          socialLinks: {
            instagram: asString(asRecord(profile.socialLinks)?.instagram),
            twitter: asString(asRecord(profile.socialLinks)?.twitter),
            linkedin: asString(asRecord(profile.socialLinks)?.linkedin),
            facebook: asString(asRecord(profile.socialLinks)?.facebook),
            youtube: asString(asRecord(profile.socialLinks)?.youtube),
          },
          coverImage: profileCoverImage,
        }
      : null,
    billingAccount: billingAccount
      ? {
          billingStatus: asString(billingAccount.billingStatus),
          stripeMode: asString(billingAccount.stripeMode),
          updatedAt: asDateString(billingAccount.updatedAt),
        }
      : null,
    subscriptions: subscriptions.map((subscription) => ({
      id: String(subscription.id),
      plan: asString(subscription.plan),
      status: asString(subscription.status),
      cancelAtPeriodEnd: asBoolean(subscription.cancelAtPeriodEnd),
      currentPeriodEnd: asDateString(subscription.currentPeriodEnd),
    })),
    groups: groups
      .filter((group) => getRelationshipIds(group.members).includes(normalizedMemberId))
      .map((group) => ({
        id: String(group.id),
        name: asString(group.name) ?? 'Unnamed group',
        slug: asString(group.slug),
      })),
  }
}
