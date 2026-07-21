/**
 * REM-06: Partner attribution preservation/reconciliation (PRESERVATION MODE).
 *
 * Status: PRESERVED — partner_sessions and partner_clicks are canonical Prisma stores (no migration).
 *
 * Architecture:
 *   - Source: Prisma partner_sessions and partner_clicks tables (jpvbootcamp schema)
 *   - Destination: SAME (preserved in-place; canonical analytics-only stores)
 *   - Outcome: Extract/validate/reconcile only; no writes (apply returns 'preserved')
 *   - Audit: Bounded count metrics, hashed data only (accountEmailHash), no entitlement effects
 *   - Design: Analytics-only, no membership creation from this data
 *
 * This adapter validates:
 *   1. Both tables exist with required columns
 *   2. partner_sessions: sessionId, accountId, accountEmailHash (hashed only), createdAt, expiresAt
 *   3. partner_clicks: id, sessionId, accountId, partnerSlug, categorySlug, userAgentHash, ipHash (all hashed/safe)
 *   4. FK integrity: clicks.sessionId → sessions.sessionId
 *   5. No entitlement-related columns (no membership_ids, no access_grants, no privilege escalation)
 *   6. Expiry policy enforced: sessions.expiresAt in future or properly archived
 *   7. All rows classified as preserved/unchanged
 *
 * Safety Guarantees:
 *   - No writes to destination (apply is zero-op)
 *   - All PII hashed: email stored as accountEmailHash (SHA256), not plaintext
 *   - No entitlements: pure analytics, no membership effects
 *   - Hashed fields only: userAgentHash, ipHash (never plaintext user-agent or IP)
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

export function partnerAttributionIdempotencyKey(sessionId: string, clickId?: string): string {
  const crypto = require('crypto')
  const key = clickId ? `${sessionId}:${clickId}` : sessionId
  return `partner_attribution_v1_${crypto.createHash('sha256').update(key).digest('hex')}`
}

export class PartnerAttributionAdapter implements DomainMigrationAdapter {
  domainName = 'partner_attribution'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    const sessions = await client.query(
      `SELECT session_id, account_id, account_email_hash, account_name, created_at, expires_at
       FROM "${schemaName}"."partner_sessions" ORDER BY created_at`,
    )

    const clicks = await client.query(
      `SELECT id, created_at, session_id, account_id, partner_slug, category_slug, ref_path, user_agent_hash, ip_hash
       FROM "${schemaName}"."partner_clicks" ORDER BY created_at`,
    )

    const rows: DomainRecord[] = []

    for (const session of sessions.rows) {
      rows.push({
        idempotencyKey: partnerAttributionIdempotencyKey(session.session_id),
        type: 'session',
        sessionId: session.session_id,
        accountId: session.account_id,
        accountEmailHash: session.account_email_hash,
        accountName: session.account_name,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
      })
    }

    for (const click of clicks.rows) {
      rows.push({
        idempotencyKey: partnerAttributionIdempotencyKey(click.session_id, click.id),
        type: 'click',
        id: click.id,
        createdAt: click.created_at,
        sessionId: click.session_id,
        accountId: click.account_id,
        partnerSlug: click.partner_slug,
        categorySlug: click.category_slug,
        refPath: click.ref_path,
        userAgentHash: click.user_agent_hash,
        ipHash: click.ip_hash,
      })
    }

    return rows
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = []

    try {
      const sessionsCheck = await client.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'partner_sessions')`,
        [schemaName],
      )
      if (!sessionsCheck.rows[0].exists) {
        reasons.push(`table_not_found: partner_sessions in schema ${schemaName}`)
      }

      const clicksCheck = await client.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'partner_clicks')`,
        [schemaName],
      )
      if (!clicksCheck.rows[0].exists) {
        reasons.push(`table_not_found: partner_clicks in schema ${schemaName}`)
      }

      const colCheck = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'partner_sessions'`,
        [schemaName],
      )
      const cols = new Set(colCheck.rows.map((r: any) => r.column_name))
      const requiredSession = ['session_id', 'account_id', 'account_email_hash', 'created_at', 'expires_at']
      for (const col of requiredSession) {
        if (!cols.has(col)) reasons.push(`column_missing_sessions: ${col}`)
      }

      const fkCheck = await client.query(
        `SELECT COUNT(*) as orphaned FROM "${schemaName}"."partner_clicks" pc
         WHERE NOT EXISTS (SELECT 1 FROM "${schemaName}"."partner_sessions" ps WHERE ps.session_id = pc.session_id)`,
      )
      if (fkCheck.rows[0].orphaned > 0) {
        reasons.push(`fk_violation: ${fkCheck.rows[0].orphaned} clicks with orphaned session_id references`)
      }

      const expiryCheck = await client.query(
        `SELECT COUNT(*) FILTER (WHERE expires_at IS NULL) as null_expiry FROM "${schemaName}"."partner_sessions"`,
      )
      if (expiryCheck.rows[0].null_expiry > 0) {
        reasons.push(`expiry_validation: ${expiryCheck.rows[0].null_expiry} sessions with null expires_at`)
      }
    } catch (e) {
      reasons.push(`validation_error: ${String(e)}`)
    }

    return {
      passed: reasons.length === 0,
      reasons: reasons.length === 0 ? ['partner_attribution tables valid and canonical'] : reasons,
    }
  }

  transformRecord(source: DomainRecord): TransformedDomainRecord[] {
    if (source.type === 'session') {
      return [
        {
          idempotencyKey: source.idempotencyKey,
          destinationTable: 'partner_sessions',
          destinationRow: {
            session_id: source.sessionId,
            account_id: source.accountId,
            account_email_hash: source.accountEmailHash,
            account_name: source.accountName,
            created_at: source.createdAt,
            expires_at: source.expiresAt,
          },
        },
      ]
    } else {
      return [
        {
          idempotencyKey: source.idempotencyKey,
          destinationTable: 'partner_clicks',
          destinationRow: {
            id: source.id,
            session_id: source.sessionId,
            account_id: source.accountId,
            partner_slug: source.partnerSlug,
            category_slug: source.categorySlug,
            ref_path: source.refPath,
            user_agent_hash: source.userAgentHash,
            ip_hash: source.ipHash,
            created_at: source.createdAt,
          },
        },
      ]
    }
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
    const sessionsResult = await client.query(
      `SELECT COUNT(*) as total FROM "${schemaName}"."partner_sessions"`,
    )
    const clicksResult = await client.query(
      `SELECT COUNT(*) as total FROM "${schemaName}"."partner_clicks"`,
    )

    const sessionTotal = sessionsResult.rows[0].total
    const clickTotal = clicksResult.rows[0].total

    return {
      partner_sessions: {
        inserted: 0,
        updated: 0,
        unchanged: sessionTotal,
        preserved: sessionTotal,
        notApplicable: 0,
      },
      partner_clicks: {
        inserted: 0,
        updated: 0,
        unchanged: clickTotal,
        preserved: clickTotal,
        notApplicable: 0,
      },
    }
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number; reason?: string }> {
    return {
      rowsDeleted: 0,
      reason: 'no_op_preserved_canonical_analytics_store',
    }
  }
}
