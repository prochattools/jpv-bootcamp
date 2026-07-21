/**
 * REM-04: Email subscriber migration.
 *
 * Source: email_subscribers (Prisma system schema)
 * Destination: payload_subscribers (new collection, communication-only, no entitlement)
 *
 * Idempotency key: email_subscriber_v1_ + sha256(email)[0:32]
 *
 * Safety:
 *   - email is PII; stored only in controlled collection
 *   - name and source preserved
 *   - unsubscribed/bounced status preserved if source tracks it
 *   - No duplicates (ON CONFLICT upsert)
 *   - PII redaction in logs
 */

import { createHash } from 'node:crypto'
import { Client } from 'pg'
import {
  DomainMigrationAdapter,
  DomainRecord,
  DomainReconciliationMetrics,
  redactForLog,
  TransformedDomainRecord,
} from './legacyMigrationFramework'

export interface SubscriberSourceRow extends DomainRecord {
  id: string
  email: string
  name: string | null
  source: string | null
  createdAt: string
  unsubscribed?: boolean
  bounced?: boolean
}

function subscriberIdempotencyKey(email: string): string {
  return `email_subscriber_v1_${createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 32)}`
}

export class EmailSubscribersAdapter implements DomainMigrationAdapter {
  domainName = 'email_subscribers'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    const query = `
      SELECT
        id,
        email,
        name,
        source,
        createdAt,
        unsubscribed,
        bounced
      FROM ${schemaName}.email_subscribers
      WHERE email IS NOT NULL
      ORDER BY createdAt
    `

    try {
      const result = await client.query(query)
      return result.rows.map((row) => ({
        idempotencyKey: subscriberIdempotencyKey(row.email),
        ...row,
      }))
    } catch (e) {
      throw new Error(`subscribers_extract_failed: ${String(e)}`)
    }
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = []

    // Check source table existence in system/public schema (Prisma)
    const sourceCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_subscribers')`,
    )
    if (!sourceCheck.rows[0].exists) {
      reasons.push('source_table_not_found: email_subscribers')
    }

    // Check destination table existence
    const destCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payload_subscribers')`,
    )
    if (!destCheck.rows[0].exists) {
      reasons.push('destination_table_not_found: payload_subscribers')
    }

    return {
      passed: reasons.length === 0,
      reasons,
    }
  }

  transformRecord(source: SubscriberSourceRow): TransformedDomainRecord[] {
    return [
      {
        idempotencyKey: source.idempotencyKey,
        destinationTable: 'payload_subscribers',
        destinationRow: {
          email: source.email,
          name: source.name,
          source: source.source ?? 'unknown',
          status: source.bounced ? 'bounced' : source.unsubscribed ? 'unsubscribed' : 'subscribed',
          sourceId: source.idempotencyKey,
          notes: `Migrated subscriber from ${source.source ?? 'unknown'} source`,
        },
      },
    ]
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    const { destinationTable, idempotencyKey } = transformed

    // Check if already migrated by this key
    const existingMigration = await client.query(
      `SELECT * FROM public.${destinationTable}
       WHERE sourceId = $1`,
      [idempotencyKey],
    )

    if (existingMigration.rows.length > 0) {
      return { conflict: false } // Already migrated, will upsert
    }

    return { conflict: false }
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<'inserted' | 'updated' | 'unchanged' | 'not_applicable'> {
    const { destinationTable, idempotencyKey, destinationRow } = transformed

    const insertQuery = `
      INSERT INTO public.${destinationTable} (email, name, source, status, sourceId, notes, createdAt)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (sourceId) DO UPDATE SET updatedAt = NOW()
      RETURNING (xmax::TEXT::INT > 0) as was_updated
    `

    const result = await client.query(insertQuery, [
      destinationRow.email,
      destinationRow.name,
      destinationRow.source,
      destinationRow.status,
      idempotencyKey,
      destinationRow.notes,
    ])

    return result.rows[0].was_updated ? 'updated' : 'inserted'
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    // Count subscribers migrated
    const result = await client.query(
      `SELECT
        COUNT(CASE WHEN sourceId LIKE 'email_subscriber_v1_%' THEN 1 END) as migrated,
        COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN status = 'unsubscribed' THEN 1 END) as unsubscribed
       FROM public.payload_subscribers`,
    )

    return {
      payload_subscribers: {
        inserted: result.rows[0].migrated,
        updated: 0,
        unchanged: 0,
        notApplicable: 0,
      },
    }
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    const result = await client.query(
      `DELETE FROM public.payload_subscribers
       WHERE sourceId LIKE 'email_subscriber_v1_%'
       RETURNING id`,
    )

    return { rowsDeleted: result.rows.length }
  }
}
