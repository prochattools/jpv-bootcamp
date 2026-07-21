/**
 * REM-06: Partner attribution preservation (BLOCKED — analytics/attribution only).
 *
 * Status: BLOCKED - Destination collections not yet implemented
 *
 * This adapter is a stub that refuses to run.
 * Partner attribution data (sessions and clicks) are currently only in the legacy schema.
 * To implement this migration, first define:
 *   1. Payload collection schema for partner attribution sessions
 *   2. Payload collection schema for partner attribution clicks
 *   3. Migration strategy (preserve hashed data, analytics-only, no entitlement)
 *   4. Data transformation and PII guarantees
 *
 * See docs/MIGRATION_ROADMAP.md for design discussion.
 */

import { Client } from 'pg'
import {
  DomainMigrationAdapter,
  DomainRecord,
  DomainReconciliationMetrics,
  TransformedDomainRecord,
} from './legacyMigrationFramework'

export class PartnerAttributionAdapter implements DomainMigrationAdapter {
  domainName = 'partner_attribution'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    throw new Error(
      'rem_06_blocked: partner attribution adapter not available. ' +
        'Destination collections payload_partner_attribution_sessions and payload_partner_attribution_clicks not yet defined. ' +
        'See docs/MIGRATION_ROADMAP.md for design requirements.',
    )
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    return {
      passed: false,
      reasons: [
        'rem_06_blocked: partner attribution adapter not available',
        'destination_collections_not_defined: payload_partner_attribution_sessions, payload_partner_attribution_clicks',
      ],
    }
  }

  transformRecord(source: any): TransformedDomainRecord[] {
    throw new Error('rem_06_blocked: partner attribution adapter not available')
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    throw new Error('rem_06_blocked: partner attribution adapter not available')
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<'inserted' | 'updated' | 'unchanged' | 'not_applicable'> {
    throw new Error('rem_06_blocked: partner attribution adapter not available')
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    throw new Error('rem_06_blocked: partner attribution adapter not available')
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    throw new Error('rem_06_blocked: partner attribution adapter not available')
  }
}
