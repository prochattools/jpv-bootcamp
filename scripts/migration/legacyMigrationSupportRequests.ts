/**
 * REM-05: Support request preservation/migration (BLOCKED).
 *
 * Status: BLOCKED - Destination collection not yet implemented
 *
 * This adapter is a stub that refuses to run.
 * Support requests are currently managed through Prisma support_requests table.
 * To implement this migration, first define:
 *   1. Payload collection schema for support requests (or decide if they stay in Prisma)
 *   2. If migrating to Payload, design the target schema
 *   3. Data transformation strategy (PII handling, status mapping, etc.)
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

export class SupportRequestsAdapter implements DomainMigrationAdapter {
  domainName = 'support_requests'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    throw new Error(
      'rem_05_blocked: support request adapter not available. ' +
        'Destination collection payload_support_requests not yet defined. ' +
        'See docs/MIGRATION_ROADMAP.md for design requirements.',
    )
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    return {
      passed: false,
      reasons: [
        'rem_05_blocked: support request adapter not available',
        'destination_collection_not_defined: payload_support_requests',
      ],
    }
  }

  transformRecord(source: any): TransformedDomainRecord[] {
    throw new Error('rem_05_blocked: support request adapter not available')
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    throw new Error('rem_05_blocked: support request adapter not available')
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<'inserted' | 'updated' | 'unchanged' | 'not_applicable'> {
    throw new Error('rem_05_blocked: support request adapter not available')
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    throw new Error('rem_05_blocked: support request adapter not available')
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    throw new Error('rem_05_blocked: support request adapter not available')
  }
}
