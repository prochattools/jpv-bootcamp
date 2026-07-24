export type LiveSessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

export type LiveSessionAuditEntry = {
  event: 'created' | 'session_updated' | 'status_changed'
  timestamp: string
  operator: string | null
  changedFields?: string[]
  fromStatus?: LiveSessionStatus
  toStatus?: LiveSessionStatus
}

export type LiveSessionDocument = Record<string, unknown> & {
  id?: string | number
  title?: string
  status?: LiveSessionStatus
  course?: unknown
  module?: unknown
  lesson?: unknown
  roomName?: string
  hostUser?: unknown
  scheduledAt?: string
  capacity?: number
  audit?: unknown
}

export type LiveSessionPayloadAPI = {
  findByID(args: {
    collection: string
    id: string | number
    depth?: number
    overrideAccess?: boolean
  }): Promise<unknown>
}

const ROOM_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/
const AUDITED_FIELDS = [
  'title',
  'status',
  'course',
  'module',
  'lesson',
  'hostUser',
  'scheduledAt',
  'capacity',
] as const

const ALLOWED_TRANSITIONS: Record<LiveSessionStatus, readonly LiveSessionStatus[]> = {
  scheduled: ['scheduled', 'live', 'cancelled'],
  live: ['live', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
}

export function liveSessionRelationshipId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    return normalized || null
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return liveSessionRelationshipId((value as { id?: unknown }).id)
  }
  return null
}

function sanitizeRoomSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateLiveSessionRoomName(input: {
  courseId: string
  moduleId?: string | null
  lessonId?: string | null
}): string {
  const course = sanitizeRoomSegment(input.courseId)
  const module = sanitizeRoomSegment(input.moduleId ?? 'general')
  const lesson = sanitizeRoomSegment(input.lessonId ?? 'general')
  if (!course || !module || !lesson) {
    throw new Error('Live session relationships cannot generate a valid room name.')
  }

  const roomName = `jpv-course-${course}-module-${module}-lesson-${lesson}`.slice(0, 128)
  if (!isValidLiveSessionRoomName(roomName)) {
    throw new Error('Generated LiveKit room name is invalid.')
  }
  return roomName
}

export function isValidLiveSessionRoomName(value: unknown): value is string {
  return typeof value === 'string' && ROOM_NAME_PATTERN.test(value) && value.length <= 128
}

export function assertLiveSessionStatusTransition(
  fromStatus: LiveSessionStatus,
  toStatus: LiveSessionStatus,
): void {
  if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new Error(`Live session status cannot transition from ${fromStatus} to ${toStatus}.`)
  }
}

function sameRelationship(left: unknown, right: unknown): boolean {
  return liveSessionRelationshipId(left) === liveSessionRelationshipId(right)
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  return value
}

export function changedLiveSessionFields(
  original: LiveSessionDocument,
  next: LiveSessionDocument,
): string[] {
  return AUDITED_FIELDS.filter((field) => {
    if (field === 'course' || field === 'module' || field === 'lesson' || field === 'hostUser') {
      return !sameRelationship(original[field], next[field])
    }
    return comparable(original[field]) !== comparable(next[field])
  })
}

function parseAudit(value: unknown): LiveSessionAuditEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is LiveSessionAuditEntry => {
    return Boolean(entry && typeof entry === 'object' && typeof entry.timestamp === 'string')
  })
}

export function appendLiveSessionAudit(params: {
  existing: unknown
  event: LiveSessionAuditEntry
}): LiveSessionAuditEntry[] {
  return [...parseAudit(params.existing), params.event].slice(-100)
}

export function prepareLiveSessionMutation(params: {
  operation: 'create' | 'update'
  data: LiveSessionDocument
  originalDoc?: LiveSessionDocument | null
  operatorId?: string | number | null
  now?: Date
}): LiveSessionDocument {
  const now = params.now ?? new Date()
  const timestamp = now.toISOString()
  const operator = params.operatorId == null ? null : String(params.operatorId)

  if (params.operation === 'create') {
    const status = params.data.status ?? 'scheduled'
    if (status !== 'scheduled') {
      throw new Error('New live sessions must start in scheduled status.')
    }
    const courseId = liveSessionRelationshipId(params.data.course)
    if (!courseId) throw new Error('Live session course is required.')

    return {
      ...params.data,
      status,
      roomName: generateLiveSessionRoomName({
        courseId,
        moduleId: liveSessionRelationshipId(params.data.module),
        lessonId: liveSessionRelationshipId(params.data.lesson),
      }),
      audit: appendLiveSessionAudit({
        existing: params.data.audit,
        event: { event: 'created', timestamp, operator, toStatus: status },
      }),
    }
  }

  const original = params.originalDoc
  if (!original) throw new Error('Existing live session document is required for updates.')
  const merged: LiveSessionDocument = { ...original, ...params.data }
  const fromStatus = original.status ?? 'scheduled'
  const toStatus = merged.status ?? fromStatus
  assertLiveSessionStatusTransition(fromStatus, toStatus)

  if (!isValidLiveSessionRoomName(original.roomName)) {
    throw new Error('Existing live session has an invalid room name.')
  }
  if (params.data.roomName !== undefined && params.data.roomName !== original.roomName) {
    throw new Error('Room name cannot be changed after creation.')
  }

  const changedFields = changedLiveSessionFields(original, merged)
  if (changedFields.length === 0) {
    return { ...params.data, roomName: original.roomName, audit: original.audit }
  }
  if (fromStatus === 'completed' || fromStatus === 'cancelled') {
    throw new Error(`${fromStatus} live sessions are immutable.`)
  }

  const event: LiveSessionAuditEntry = fromStatus === toStatus
    ? { event: 'session_updated', timestamp, operator, changedFields }
    : {
        event: 'status_changed',
        timestamp,
        operator,
        changedFields,
        fromStatus,
        toStatus,
      }

  return {
    ...params.data,
    roomName: original.roomName,
    audit: appendLiveSessionAudit({ existing: original.audit, event }),
    ...(fromStatus !== 'live' && toStatus === 'live' ? { startedAt: timestamp } : {}),
    ...(toStatus === 'completed' ? { completedAt: timestamp } : {}),
    ...(toStatus === 'cancelled' ? { cancelledAt: timestamp } : {}),
  }
}

export async function assertLiveSessionRelationships(params: {
  payload: LiveSessionPayloadAPI
  course: unknown
  module?: unknown
  lesson?: unknown
}): Promise<void> {
  const courseId = liveSessionRelationshipId(params.course)
  const moduleId = liveSessionRelationshipId(params.module)
  const lessonId = liveSessionRelationshipId(params.lesson)
  if (!courseId) throw new Error('Live session course is required.')
  if (lessonId && !moduleId) throw new Error('A lesson relationship requires its module relationship.')

  await params.payload.findByID({
    collection: 'payload_courses',
    id: courseId,
    depth: 0,
    overrideAccess: true,
  })

  if (moduleId) {
    const module = await params.payload.findByID({
      collection: 'payload_course_modules',
      id: moduleId,
      depth: 0,
      overrideAccess: true,
    }) as Record<string, unknown>
    if (liveSessionRelationshipId(module.course) !== courseId) {
      throw new Error('Live session module does not belong to the selected course.')
    }
  }

  if (lessonId) {
    const lesson = await params.payload.findByID({
      collection: 'payload_lessons',
      id: lessonId,
      depth: 0,
      overrideAccess: true,
    }) as Record<string, unknown>
    if (liveSessionRelationshipId(lesson.module) !== moduleId) {
      throw new Error('Live session lesson does not belong to the selected module.')
    }
  }
}
