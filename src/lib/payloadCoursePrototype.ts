const isDevelopment = process.env.NODE_ENV === 'development'
const isExplicitlyEnabled = process.env.NEXT_PUBLIC_PAYLOAD_COURSE_PROTOTYPE_ENABLED === 'true'

/**
 * Preview-only boundary for the Payload course prototype.
 *
 * The prototype is intentionally disabled unless it is explicitly enabled in
 * a development environment. It must not be used as an access-control check.
 */
export const PAYLOAD_COURSE_PROTOTYPE_ENABLED = isDevelopment && isExplicitlyEnabled

export const PAYLOAD_COURSE_PROTOTYPE_ROUTE = '/course-preview'

export const PAYLOAD_COURSE_PROTOTYPE_BANNER =
  'Prototype preview — demo content only. Course access, billing, and progress are not connected.'
