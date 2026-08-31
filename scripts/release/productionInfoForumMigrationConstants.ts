import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'

export const INFO_FORUM_PRODUCTION_CONFIRMATION = 'apply-info-forum-to-forum-production' as const
export const INFO_FORUM_REHEARSAL_CONFIRMATION = 'rehearse-info-forum-to-forum-on-restored-production-backup' as const
export const INFO_FORUM_TARGET = {
  ...ENVIRONMENT_TOPOLOGY.production,
  targetId: 'jpvbootcamp-production',
} as const

export type InfoForumMigrationMode = 'plan' | 'apply'
