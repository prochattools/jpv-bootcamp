import { quotePgIdentifier } from './payloadMigrationSchema'

const relationshipConstraints = [
	{
		table: 'payload_member_profiles',
		constraint: 'payload_member_profiles_member_id_payload_members_id_fk',
		column: 'member_id',
	},
	{
		table: 'payload_course_enrollments',
		constraint: 'payload_course_enrollments_member_id_payload_members_id_fk',
		column: 'member_id',
	},
	{
		table: 'payload_lesson_progress',
		constraint: 'payload_lesson_progress_member_id_payload_members_id_fk',
		column: 'member_id',
	},
	{
		table: 'payload_billing_accounts',
		constraint: 'payload_billing_accounts_member_id_payload_members_id_fk',
		column: 'member_id',
	},
	{
		table: 'payload_subscriptions',
		constraint: 'payload_subscriptions_member_id_payload_members_id_fk',
		column: 'member_id',
	},
	{
		table: 'payload_space_memberships',
		constraint: 'payload_space_memberships_member_id_payload_members_id_fk',
		column: 'member_id',
	},
	{
		table: 'payload_subscriptions',
		constraint: 'payload_subscriptions_billing_account_id_payload_billing_accounts_id_fk',
		column: 'billing_account_id',
	},
] as const

const auditColumns = [
	{ table: 'payload_member_security_events', column: 'member_id' },
] as const

export function buildMemberDeleteRelationshipUpSql(schemaName: string): string {
	const schema = quotePgIdentifier(schemaName)
	const cascadeStatements = relationshipConstraints.map(({ table, constraint, column }) => {
		const quotedTable = `${schema}.${quotePgIdentifier(table)}`
		return [
			`ALTER TABLE ${quotedTable} DROP CONSTRAINT IF EXISTS ${quotePgIdentifier(constraint)};`,
			`ALTER TABLE ${quotedTable} ADD CONSTRAINT ${quotePgIdentifier(constraint)} FOREIGN KEY (${quotePgIdentifier(column)}) REFERENCES ${schema}.${quotePgIdentifier('payload_members')}(${quotePgIdentifier('id')}) ON DELETE CASCADE ON UPDATE no action;`,
		].join('\n')
	})
	const auditStatements = auditColumns.map(({ table, column }) =>
		`ALTER TABLE ${schema}.${quotePgIdentifier(table)} ALTER COLUMN ${quotePgIdentifier(column)} DROP NOT NULL;`,
	)

	return [...cascadeStatements, ...auditStatements].join('\n')
}

export function buildMemberDeleteRelationshipDownSql(schemaName: string): string {
	const schema = quotePgIdentifier(schemaName)
	const restoreStatements = relationshipConstraints.map(({ table, constraint, column }) => {
		const quotedTable = `${schema}.${quotePgIdentifier(table)}`
		return [
			`ALTER TABLE ${quotedTable} DROP CONSTRAINT IF EXISTS ${quotePgIdentifier(constraint)};`,
			`ALTER TABLE ${quotedTable} ADD CONSTRAINT ${quotePgIdentifier(constraint)} FOREIGN KEY (${quotePgIdentifier(column)}) REFERENCES ${schema}.${quotePgIdentifier('payload_members')}(${quotePgIdentifier('id')}) ON DELETE SET NULL ON UPDATE no action;`,
		].join('\n')
	})
	const auditStatements = auditColumns.map(({ table, column }) =>
		`ALTER TABLE ${schema}.${quotePgIdentifier(table)} ALTER COLUMN ${quotePgIdentifier(column)} SET NOT NULL;`,
	)

	return [...restoreStatements, ...auditStatements].join('\n')
}
