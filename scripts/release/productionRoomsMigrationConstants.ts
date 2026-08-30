import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'

export const PRODUCTION_ROOMS_MIGRATION = '20260830_090000_member_portal_rooms' as const
export const PRODUCTION_ROOMS_MIGRATION_SOURCE_SHA256 =
	'071d47dd39d7e832117dd327c035877555542cd4ef11ec0b73050a848d496a9d' as const
export const PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256 =
	'0fdb089ae8abdeaabb7cacd8ab7452a62d266bb5038d8f470a795e4241ea3f8c' as const
export const PRODUCTION_ROOMS_BACKUP_EVIDENCE_ID = 'rooms-production-rollback-20260830T151139Z' as const
export const PRODUCTION_ROOMS_BACKUP_SHA256 =
	'1ad075fcde67b7db99e9703a3f8bdc3795b38057857c3fc1469049fa549c758b' as const
export const PRODUCTION_ROOMS_ROLLBACK_OWNER = 'production-release-owner' as const
export const PRODUCTION_ROOMS_MIGRATION_PLAN_CONFIRMATION =
	'plan-rooms-production-migration' as const
export const PRODUCTION_ROOMS_MIGRATION_APPLY_CONFIRMATION =
	'apply-rooms-production-migration-to-jpvbootcamp' as const
export const PRODUCTION_ROOMS_NAV_FINALIZE_CONFIRMATION =
	'finalize-rooms-production-navigation' as const
export const PRODUCTION_ROOMS_REHEARSAL_CONFIRMATION =
	'rehearse-rooms-production-migration-on-restored-backup' as const

export const PRODUCTION_ROOMS_TARGET = {
	...ENVIRONMENT_TOPOLOGY.production,
	targetId: 'jpvbootcamp-production',
	role: ENVIRONMENT_TOPOLOGY.production.databaseRole,
} as const

export const PRODUCTION_ROOMS_LEGACY_NAVIGATION = {
	label: 'Live',
	href: '/portal/live-sessions',
} as const

export const PRODUCTION_ROOMS_FINAL_NAVIGATION = {
	label: 'Rooms',
	href: '/portal/rooms',
} as const

export const PRODUCTION_ROOMS_CRITICAL_TABLES = [
	'payload_members',
	'payload_users',
	'payload_courses',
	'payload_course_enrollments',
	'payload_spaces',
	'payload_space_memberships',
	'live_sessions',
	'payload_portal_nav_items',
	'payload_member_notifications',
	'payload_admin_notifications',
	'payload_email_events',
	'payload_email_actions',
	'payload_subscriptions',
	'payload_billing_accounts',
	'payload_billing_actions',
	'payload_locked_documents_rels',
] as const

export const PRODUCTION_ROOMS_HISTORICAL_ANOMALY_WINDOW = [
	{ id: 45, name: '20260825_124000_membership_review_assignee_alignment', batch: 13 },
	{ id: 46, name: '20260825_125000_membership_shadow_state_alignment', batch: 14 },
	{ id: 47, name: '20260826_090000_payment_action_required_status', batch: 15 },
	{ id: 48, name: '20260826_120000_billing_pause_actions', batch: 16 },
	{ id: 49, name: '20260826_130000_portal_engagement_distribution', batch: 17 },
	{ id: 50, name: '20260826_100000_administrator_member_identity', batch: 18 },
	{ id: 51, name: '20260826_150000_member_delete_relationship_safety', batch: 18 },
	{ id: 52, name: '20260827_090000_membership_support_relationship_tables', batch: 19 },
] as const

export type ProductionRoomsMigrationMode = 'plan' | 'apply' | 'finalize'
