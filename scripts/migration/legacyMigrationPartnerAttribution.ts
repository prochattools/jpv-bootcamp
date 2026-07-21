/**
 * REM-06: Partner attribution preservation (DEFERRED — analytics/attribution only).
 *
 * Source: jpvbootcamp.partner_sessions, jpvbootcamp.partner_clicks
 * Destination: payload_partner_attribution (new analytics/attribution collection)
 *
 * Idempotency keys:
 *   - partner_sessions: session_id
 *   - partner_clicks: id
 *
 * Safety:
 *   - account_email_hash, ip_hash, user_agent_hash (already hashed in source)
 *   - No raw PII in destination
 *   - Orphaned sessions (account deleted) handled gracefully
 *   - No member entitlements from attribution data
 */

import { Client } from 'pg'
import {
  DomainMigrationAdapter,
  DomainRecord,
  DomainReconciliationMetrics,
  TransformedDomainRecord,
} from './legacyMigrationFramework'

export interface PartnerSessionRow extends DomainRecord {
  session_id: string
  account_id: string | null
  account_email_hash: string | null
  ip_hash: string | null
  user_agent_hash: string | null
  partner_slug: string | null
  created_at: string
  expires_at: string | null
}

export interface PartnerClickRow extends DomainRecord {
  id: string
  session_id: string | null
  partner_slug: string
  category_slug: string | null
  created_at: string
}

export class PartnerAttributionAdapter implements DomainMigrationAdapter {
  domainName = 'partner_attribution'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    const sessionQuery = `
      SELECT
        session_id as idempotencyKey,
        'session' as type,
        session_id,
        account_id,
        account_email_hash,
        ip_hash,
        user_agent_hash,
        partner_slug,
        created_at,
        expires_at
      FROM ${schemaName}.partner_sessions
      WHERE created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `

    const clickQuery = `
      SELECT
        id as idempotencyKey,
        'click' as type,
        id,
        session_id,
        partner_slug,
        category_slug,
        created_at
      FROM ${schemaName}.partner_clicks
      WHERE created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `

    try {
      const [sessions, clicks] = await Promise.all([client.query(sessionQuery), client.query(clickQuery)])

      return [
        ...sessions.rows.map((row) => ({
          idempotencyKey: row.session_id,
          recordType: 'session',
          ...row,
        })),
        ...clicks.rows.map((row) => ({
          idempotencyKey: row.id,
          recordType: 'click',
          ...row,
        })),
      ]
    } catch (e) {
      throw new Error(`partner_attribution_extract_failed: ${String(e)}`)
    }
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = []

    // Check source tables
    const sessionsCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'partner_sessions')`,
      [schemaName],
    )
    if (!sessionsCheck.rows[0].exists) {
      reasons.push('source_table_not_found: partner_sessions')
    }

    const clicksCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'partner_clicks')`,
      [schemaName],
    )
    if (!clicksCheck.rows[0].exists) {
      reasons.push('source_table_not_found: partner_clicks')
    }

    // Check destination table
    const destCheck = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payload_partner_attribution')`,
    )
    if (!destCheck.rows[0].exists) {
      reasons.push('destination_table_not_found: payload_partner_attribution')
    }

    return {
      passed: reasons.length === 0,
      reasons,
    }
  }

  transformRecord(source: any): TransformedDomainRecord[] {
    if (source.recordType === 'session') {
      return [
        {
          idempotencyKey: source.idempotencyKey,
          destinationTable: 'payload_partner_attribution_sessions',
          destinationRow: {
            sessionId: source.session_id,
            accountId: source.account_id,
            accountEmailHash: source.account_email_hash,
            ipHash: source.ip_hash,
            userAgentHash: source.user_agent_hash,
            partnerSlug: source.partner_slug,
            createdAt: source.created_at,
            expiresAt: source.expires_at,
          },
        },
      ]
    } else if (source.recordType === 'click') {
      return [
        {
          idempotencyKey: source.idempotencyKey,
          destinationTable: 'payload_partner_attribution_clicks',
          destinationRow: {
            clickId: source.id,
            sessionId: source.session_id,
            partnerSlug: source.partner_slug,
            categorySlug: source.category_slug,
            createdAt: source.created_at,
          },
        },
      ]
    }
    return []
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    const { destinationTable, idempotencyKey } = transformed

    // Check if already migrated
    const existing = await client.query(
      `SELECT * FROM public.${destinationTable}
       WHERE id = $1 OR sessionId = $2`,
      [idempotencyKey, idempotencyKey],
    )

    if (existing.rows.length > 0) {
      return { conflict: false } // Already exists
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

    if (destinationTable === 'payload_partner_attribution_sessions') {
      const insertQuery = `
        INSERT INTO public.${destinationTable} (sessionId, accountId, accountEmailHash, ipHash, userAgentHash, partnerSlug, createdAt, expiresAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (sessionId) DO NOTHING
        RETURNING (xmax::TEXT::INT > 0) as was_updated
      `

      const result = await client.query(insertQuery, [
        destinationRow.sessionId,
        destinationRow.accountId,
        destinationRow.accountEmailHash,
        destinationRow.ipHash,
        destinationRow.userAgentHash,
        destinationRow.partnerSlug,
        destinationRow.createdAt,
        destinationRow.expiresAt,
      ])

      return result.rows.length > 0 ? 'inserted' : 'unchanged'
    } else {
      const insertQuery = `
        INSERT INTO public.${destinationTable} (clickId, sessionId, partnerSlug, categorySlug, createdAt)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (clickId) DO NOTHING
        RETURNING (xmax::TEXT::INT > 0) as was_updated
      `

      const result = await client.query(insertQuery, [
        destinationRow.clickId,
        destinationRow.sessionId,
        destinationRow.partnerSlug,
        destinationRow.categorySlug,
        destinationRow.createdAt,
      ])

      return result.rows.length > 0 ? 'inserted' : 'unchanged'
    }
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    const [sessionsResult, clicksResult] = await Promise.all([
      client.query(`SELECT COUNT(*) as count FROM public.payload_partner_attribution_sessions`),
      client.query(`SELECT COUNT(*) as count FROM public.payload_partner_attribution_clicks`),
    ])

    return {
      payload_partner_attribution_sessions: {
        inserted: sessionsResult.rows[0].count,
        updated: 0,
        unchanged: 0,
        notApplicable: 0,
      },
      payload_partner_attribution_clicks: {
        inserted: clicksResult.rows[0].count,
        updated: 0,
        unchanged: 0,
        notApplicable: 0,
      },
    }
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    const [sessionsResult, clicksResult] = await Promise.all([
      client.query(`DELETE FROM public.payload_partner_attribution_sessions RETURNING id`),
      client.query(`DELETE FROM public.payload_partner_attribution_clicks RETURNING id`),
    ])

    return { rowsDeleted: sessionsResult.rows.length + clicksResult.rows.length }
  }
}
