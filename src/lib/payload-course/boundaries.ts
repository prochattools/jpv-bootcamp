/**
 * Payload Course Prototype Boundary Constants
 *
 * Defines the scope and visibility of the course prototype feature.
 * Per PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md § 10.2
 */

export const PAYLOAD_COURSE_PROTOTYPE_ENABLED =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_COURSE_PROTOTYPE !== 'false'

export const PAYLOAD_COURSE_PROTOTYPE_ROUTE = '/course-preview'

export const PAYLOAD_COURSE_PROTOTYPE_BANNER =
  'Visual prototype only — no live member, course or billing data'
