/**
 * Behavioral tests for course collection access control.
 *
 * Verifies that:
 *   - Members (payload_members) cannot create, update, or delete course content
 *   - Admins (payload_users) have full write access
 *   - Anonymous users receive a published-only filter on read
 *   - Members receive a published-only filter on course/module read (not full access)
 *   - Admins receive unrestricted read (true, not a filter)
 *   - Lessons (no status field) return a previewLesson filter for non-admins
 *
 * Run with: pnpm exec vitest run src/__tests__/course-access-control.test.ts
 */

import { describe, it, expect } from 'vitest'
import type { PayloadRequest } from 'payload'

import {
  PayloadCourses,
  PayloadCourseModules,
  PayloadLessons,
  PayloadCourseAccessPreview,
} from '@/collections/PayloadCoursePrototype'

// ---------------------------------------------------------------------------
// Helpers to build minimal mock PayloadRequest objects
// ---------------------------------------------------------------------------

function makeAdminReq(): PayloadRequest {
  return {
    user: { id: 'admin-1', collection: 'payload_users' },
  } as unknown as PayloadRequest
}

function makeMemberReq(): PayloadRequest {
  return {
    user: { id: 'member-1', collection: 'payload_members' },
  } as unknown as PayloadRequest
}

function makeAnonReq(): PayloadRequest {
  return {
    user: null,
  } as unknown as PayloadRequest
}

// ---------------------------------------------------------------------------
// Shorthand callers — Payload access functions accept { req, id?, data? }
// ---------------------------------------------------------------------------

function callCreate(collection: typeof PayloadCourses, req: PayloadRequest) {
  return collection.access?.create?.({ req } as Parameters<Exclude<typeof collection.access.create, undefined>>[0])
}

function callUpdate(collection: typeof PayloadCourses, req: PayloadRequest) {
  return collection.access?.update?.({ req } as Parameters<Exclude<typeof collection.access.update, undefined>>[0])
}

function callDelete(collection: typeof PayloadCourses, req: PayloadRequest) {
  return collection.access?.delete?.({ req } as Parameters<Exclude<typeof collection.access.delete, undefined>>[0])
}

function callRead(collection: typeof PayloadCourses, req: PayloadRequest) {
  return collection.access?.read?.({ req } as Parameters<Exclude<typeof collection.access.read, undefined>>[0])
}

// ---------------------------------------------------------------------------
// Tests: member write access must be denied
// ---------------------------------------------------------------------------

describe('PayloadCourses — member write access', () => {
  const member = makeMemberReq()

  it('member cannot create a course', () => {
    expect(callCreate(PayloadCourses, member)).toBe(false)
  })

  it('member cannot update a course', () => {
    expect(callUpdate(PayloadCourses, member)).toBe(false)
  })

  it('member cannot delete a course', () => {
    expect(callDelete(PayloadCourses, member)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests: admin write access must be allowed
// ---------------------------------------------------------------------------

describe('PayloadCourses — admin write access', () => {
  const admin = makeAdminReq()

  it('admin can create a course', () => {
    expect(callCreate(PayloadCourses, admin)).toBe(true)
  })

  it('admin can update a course', () => {
    expect(callUpdate(PayloadCourses, admin)).toBe(true)
  })

  it('admin can delete a course', () => {
    expect(callDelete(PayloadCourses, admin)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: course read access filters
// ---------------------------------------------------------------------------

describe('PayloadCourses — read access filters', () => {
  it('anonymous user gets published-only filter', () => {
    const result = callRead(PayloadCourses, makeAnonReq())
    expect(result).toEqual({ status: { equals: 'published' } })
  })

  it('member gets published-only filter (not unrestricted access)', () => {
    const result = callRead(PayloadCourses, makeMemberReq())
    expect(result).toEqual({ status: { equals: 'published' } })
    // Must NOT be true — members must not see drafts
    expect(result).not.toBe(true)
  })

  it('admin sees all courses (unrestricted)', () => {
    const result = callRead(PayloadCourses, makeAdminReq())
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: module collection mirrors course access rules
// ---------------------------------------------------------------------------

describe('PayloadCourseModules — access control', () => {
  it('member cannot create a module', () => {
    expect(callCreate(PayloadCourseModules, makeMemberReq())).toBe(false)
  })

  it('admin can create a module', () => {
    expect(callCreate(PayloadCourseModules, makeAdminReq())).toBe(true)
  })

  it('anonymous user gets published-only read filter', () => {
    expect(callRead(PayloadCourseModules, makeAnonReq())).toEqual({ publishedPreview: { equals: true } })
  })

  it('admin gets unrestricted read', () => {
    expect(callRead(PayloadCourseModules, makeAdminReq())).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: lesson collection uses previewLesson filter (no status field)
// ---------------------------------------------------------------------------

describe('PayloadLessons — read access (previewLesson filter)', () => {
  it('anonymous user gets preview-only read filter', () => {
    const result = callRead(PayloadLessons, makeAnonReq())
    expect(result).toEqual({ previewLesson: { equals: true } })
  })

  it('member gets preview-only read filter (not unrestricted)', () => {
    const result = callRead(PayloadLessons, makeMemberReq())
    expect(result).toEqual({ previewLesson: { equals: true } })
    expect(result).not.toBe(true)
  })

  it('admin gets unrestricted lesson read', () => {
    expect(callRead(PayloadLessons, makeAdminReq())).toBe(true)
  })

  it('member cannot create a lesson', () => {
    expect(callCreate(PayloadLessons, makeMemberReq())).toBe(false)
  })

  it('admin can create a lesson', () => {
    expect(callCreate(PayloadLessons, makeAdminReq())).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: access preview collection
// ---------------------------------------------------------------------------

describe('PayloadCourseAccessPreview — access control', () => {
  it('member cannot create an access preview entry', () => {
    expect(callCreate(PayloadCourseAccessPreview, makeMemberReq())).toBe(false)
  })

  it('admin can create an access preview entry', () => {
    expect(callCreate(PayloadCourseAccessPreview, makeAdminReq())).toBe(true)
  })

  it('anonymous user gets published-only read filter', () => {
    expect(callRead(PayloadCourseAccessPreview, makeAnonReq())).toEqual({ status: { equals: 'published' } })
  })

  it('admin gets unrestricted read', () => {
    expect(callRead(PayloadCourseAccessPreview, makeAdminReq())).toBe(true)
  })
})
