export const INFO_FORUM_LEGACY_SLUG = 'info-forum'
/**
 * `start-here` is a known persisted production alias for the exact Info Forum
 * record. Keep it explicit so identity resolution never falls back to fuzzy
 * labels or arbitrary slug matching.
 */
export const INFO_FORUM_LEGACY_SLUG_ALIASES = ['info-forum', 'start-here'] as const
export const FORUM_CANONICAL_SLUG = 'forum'
export const INFO_FORUM_LEGACY_NAME = 'Info Forum'
export const FORUM_CANONICAL_NAME = 'Forum'
