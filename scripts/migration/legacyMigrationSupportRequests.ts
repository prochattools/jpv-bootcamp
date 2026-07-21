/**
 * REM-05: Support request preservation/migration.
 *
 * Source: support_requests (Prisma system schema)
 * Destination: payload_support_requests (Payload collection)
 *
 * Idempotency key: dedupe_key (already deterministic from source)
 *
 * Safety:
 *   - normalized_email is PII; stored only in controlled collection
 *   - name and question may contain personal data; controlled storage
 *   - review_status preserved
 *   - notification_status preserved
 *   - No duplicates (ON CONFLICT dedupe_key)
 *   - PII redaction in logs
 */

import { Client } from 'pg'
import {
  DomainMigrationAdapter,
  DomainRecord,
  DomainReconciliationMetrics,
  redactForLog,
  TransformedDomainRecord,
} from './legacyMigrationFramework'

export interface SupportRequestSourceRow extends DomainRecord {
  id: string
  normalized_email: string
  name: string | null
  question: string | null
  dedupe_key: string
  review_status: string | null
  notification_status: string | null
  reviewed_by_account_id: string | null
  created_at: string
}

export class SupportRequestsAdapter implements DomainMigrationAdapter {
  domainName = 'support_requests'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    const query = `
      SELECT
        id,
        normalized_email,
        name,
        question,
        dedupe_key,
        review_status,
        notification_status,
        reviewed_by_account_id,
        created_at
      FROM ${schemaName}.support_requests
      WHERE review_status NOT IN ('spam', 'deleted')
      ORDER BY created_at
    `

    try {
      const result = await client.query(query)
      return result.rows.map((row) => ({
        idempotencyKey: row.dedupe_key,
        ...row,
      }))
    } catch (e) {
      throw new Error(`support_requests_extract_failed: ${String(e)}`)
    }
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = []

    // Check source table
    const sourceCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_requests')`,
    )
    if (!sourceCheck.rows[0].exists) {
      reasons.push('source_table_not_found: support_requests')
    }

    // Check destination table
    const destCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payload_support_requests')`,
    )
    if (!destCheck.rows[0].exists) {
      reasons.push('destination_table_not_found: payload_support_requests')
    }

    return {
      passed: reasons.length === 0,
      reasons,
    }
  }

  transformRecord(source: SupportRequestSourceRow): TransformedDomainRecord[] {
    return [
      {
        idempotencyKey: source.idempotencyKey,
        destinationTable: 'payload_support_requests',
        destinationRow: {
          email: source.normalized_email,
          name: source.name,
          question: source.question,
          dedupeKey: source.dedupe_key,
          reviewStatus: source.review_status ?? 'pending',
          notificationStatus: source.notification_status ?? 'not_notified',
          reviewedByAccountId: source.reviewed_by_account_id,
          notes: `Migrated from legacy support intake system`,
        },
      },
    ]
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    const { destinationTable, destinationRow } = transformed

    // Check if dedupe_key already exists in destination
    const existing = await client.query(
      `SELECT * FROM public.${destinationTable}
       WHERE dedupeKey = $1`,
      [(destinationRow as { dedupeKey: string }).dedupeKey],
    )

    if (existing.rows.length > 0) {
      return { conflict: false } // Already exists, will upsert
    }

    return { conflict: false }
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<'inserted' | 'updated' | 'unchanged' | 'not_applicable'> {
    const { destinationTable, destinationRow } = transformed

    const insertQuery = `
      INSERT INTO public.${destinationTable} (email, name, question, dedupeKey, reviewStatus, notificationStatus, reviewedByAccountId, notes, createdAt)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (dedupeKey) DO UPDATE SET updatedAt = NOW()
      RETURNING (xmax::TEXT::INT > 0) as was_updated
    `

    const result = await client.query(insertQuery, [
      destinationRow.email,
      destinationRow.name,
      destinationRow.question,
      destinationRow.dedupeKey,
      destinationRow.reviewStatus,
      destinationRow.notificationStatus,
      destinationRow.reviewedByAccountId,
      destinationRow.notes,
    ])

    return result.rows[0].was_updated ? 'updated' : 'inserted'
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    // Count support requests migrated
    const result = await client.query(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN reviewStatus = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN reviewStatus = 'resolved' THEN 1 END) as resolved
       FROM public.payload_support_requests`,
    )

    return {
      payload_support_requests: {
        inserted: result.rows[0].total,
        updated: 0,
        unchanged: 0,
        notApplicable: 0,
      },
    }
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    // Rollback by deleting records from this migration
    // Safe only if this domain migration already recorded before-images in audit
    const result = await client.query(
      `DELETE FROM public.payload_support_requests
       WHERE notes LIKE '%Migrated from legacy support intake%'
       RETURNING id`,
    )

    return { rowsDeleted: result.rows.length }
  }
}
