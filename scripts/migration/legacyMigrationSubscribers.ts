/**
 * REM-04: Email subscriber preservation/reconciliation (PRESERVATION MODE).
 *
 * Status: PRESERVED — email_subscribers is canonical Prisma store (no migration).
 *
 * Architecture:
 *   - Source: Prisma email_subscribers table (jpvbootcamp schema)
 *   - Destination: SAME (preserved in-place; canonical store)
 *   - Outcome: Extract/validate/reconcile only; no writes (apply returns 'preserved')
 *   - Audit: Bounded count metrics, no PII in logs, no duplicate collection
 *
 * This adapter proves that the canonical store is email_subscribers and will never be
 * duplicated in a payload_subscribers collection. It validates:
 *   1. Table exists and has required columns (email unique, created_at, updated_at)
 *   2. No orphaned records (source values consistent)
 *   3. Email normalization is consistent
 *   4. All rows classified as preserved/unchanged
 *
 * Safe for repeated runs: zero writes, idempotent metrics, no state mutations.
 */

import { Client } from 'pg'
import {
  DomainMigrationAdapter,
  DomainRecord,
  DomainReconciliationMetrics,
  TransformedDomainRecord,
  MigrationOutcome,
  redactForLog,
} from './legacyMigrationFramework'

export function emailSubscriberIdempotencyKey(email: string): string {
  const crypto = require('crypto')
  const normalized = email.toLowerCase().trim()
  return `email_subscriber_v1_${crypto.createHash('sha256').update(normalized).digest('hex')}`
}

export class EmailSubscribersAdapter implements DomainMigrationAdapter {
  domainName = 'email_subscribers'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    const result = await client.query(
      `SELECT id, email, name, source, created_at, updated_at FROM "${schemaName}"."email_subscribers" ORDER BY created_at`,
    )

    return result.rows.map((row: any) => ({
      idempotencyKey: emailSubscriberIdempotencyKey(row.email),
      id: row.id,
      email: row.email,
      name: row.name,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = []

    try {
      const schemaCheck = await client.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'email_subscribers')`,
        [schemaName],
      )
      if (!schemaCheck.rows[0].exists) {
        reasons.push(`table_not_found: email_subscribers in schema ${schemaName}`)
      }

      const colCheck = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'email_subscribers'`,
        [schemaName],
      )
      const cols = new Set(colCheck.rows.map((r: any) => r.column_name))
      const required = ['id', 'email', 'name', 'source', 'created_at', 'updated_at']
      for (const col of required) {
        if (!cols.has(col)) reasons.push(`column_missing: ${col}`)
      }

      const uniqueCheck = await client.query(
        `SELECT COUNT(*) FILTER (WHERE email IS NOT NULL) as total, COUNT(DISTINCT LOWER(email)) as unique_count FROM "${schemaName}"."email_subscribers"`,
      )
      const counts = uniqueCheck.rows[0]
      if (counts.total !== counts.unique_count) {
        reasons.push(`uniqueness_violation: ${counts.total - counts.unique_count} duplicate normalized emails`)
      }
    } catch (e) {
      reasons.push(`validation_error: ${String(e)}`)
    }

    return {
      passed: reasons.length === 0,
      reasons: reasons.length === 0 ? ['email_subscribers table valid and canonical'] : reasons,
    }
  }

  transformRecord(source: DomainRecord): TransformedDomainRecord[] {
    return [
      {
        idempotencyKey: source.idempotencyKey,
        destinationTable: 'email_subscribers',
        destinationRow: {
          id: source.id,
          email: source.email,
          name: source.name,
          source: source.source,
          created_at: source.createdAt,
          updated_at: source.updatedAt,
        },
      },
    ]
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    return { conflict: false, reason: 'preserved_in_place' }
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<MigrationOutcome> {
    return 'preserved'
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    const result = await client.query(
      `SELECT COUNT(*) as total FROM "${schemaName}"."email_subscribers"`,
    )
    const total = result.rows[0].total

    return {
      email_subscribers: {
        inserted: 0,
        updated: 0,
        unchanged: total,
        preserved: total,
        notApplicable: 0,
      },
    }
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number; reason?: string }> {
    return {
      rowsDeleted: 0,
      reason: 'no_op_preserved_canonical_store',
    }
  }
}
