import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

const relationshipTables = [
  {
    table: 'payload_pay_it_forward_funding',
    parentConstraint: 'payload_pay_it_forward_funding_rels_parent_fk',
    notesConstraint: 'payload_pay_it_forward_funding_rels_notes_fk',
    notesIndex: 'payload_pay_it_forward_funding_rels_notes_idx',
  },
  {
    table: 'payload_membership_vouchers',
    parentConstraint: 'payload_membership_vouchers_rels_parent_fk',
    notesConstraint: 'payload_membership_vouchers_rels_notes_fk',
    notesIndex: 'payload_membership_vouchers_rels_notes_idx',
  },
  {
    table: 'payload_membership_administration_actions',
    parentConstraint: 'payload_membership_administration_actions_rels_parent_fk',
    notesConstraint: 'payload_membership_administration_actions_rels_notes_fk',
    notesIndex: 'payload_membership_administration_actions_rels_notes_idx',
  },
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  const statements = relationshipTables.flatMap(({ table, parentConstraint, notesConstraint, notesIndex }) => {
    const relationTable = `${table}_rels`
    return [
      `CREATE TABLE ${schema}."${relationTable}" (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL,
        "payload_operator_notes_id" integer
      );`,
      `ALTER TABLE ${schema}."${relationTable}"
        ADD CONSTRAINT "${parentConstraint}"
        FOREIGN KEY ("parent_id") REFERENCES ${schema}."${table}"("id") ON DELETE cascade;`,
      `ALTER TABLE ${schema}."${relationTable}"
        ADD CONSTRAINT "${notesConstraint}"
        FOREIGN KEY ("payload_operator_notes_id") REFERENCES ${schema}."payload_operator_notes"("id") ON DELETE cascade;`,
      `CREATE INDEX "${relationTable}_order_idx" ON ${schema}."${relationTable}" ("order");`,
      `CREATE INDEX "${relationTable}_parent_idx" ON ${schema}."${relationTable}" ("parent_id");`,
      `CREATE INDEX "${relationTable}_path_idx" ON ${schema}."${relationTable}" ("path");`,
      `CREATE INDEX "${notesIndex}" ON ${schema}."${relationTable}" ("payload_operator_notes_id");`,
    ]
  })

  await db.execute(sql.raw(statements.join('\n')))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  const statements = relationshipTables
    .map(({ table }) => `DROP TABLE IF EXISTS ${schema}."${table}_rels" CASCADE;`)
    .join('\n')

  await db.execute(sql.raw(statements))
}
