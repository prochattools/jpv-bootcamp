/**
 * REM-04: Email subscriber migration (BLOCKED).
 *
 * Status: BLOCKED - Destination collection not yet implemented
 *
 * This adapter is a stub that refuses to run.
 * Email subscriber management is currently handled through Prisma email_subscribers table.
 * To implement this migration, first define:
 *   1. Payload collection schema for email subscribers
 *   2. Migration strategy for email_subscribers → payload_subscribers
 *   3. Data transformation (PII handling, status mapping, etc.)
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

export class EmailSubscribersAdapter implements DomainMigrationAdapter {
  domainName = 'email_subscribers'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    throw new Error(
      'rem_04_blocked: email subscriber adapter not available. ' +
        'Destination collection payload_subscribers not yet defined. ' +
        'See docs/MIGRATION_ROADMAP.md for design requirements.',
    )
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    return {
      passed: false,
      reasons: [
        'rem_04_blocked: email subscriber adapter not available',
        'destination_collection_not_defined: payload_subscribers',
      ],
    }
  }

  transformRecord(source: any): TransformedDomainRecord[] {
    throw new Error('rem_04_blocked: email subscriber adapter not available')
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    throw new Error('rem_04_blocked: email subscriber adapter not available')
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<'inserted' | 'updated' | 'unchanged' | 'not_applicable'> {
    throw new Error('rem_04_blocked: email subscriber adapter not available')
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    throw new Error('rem_04_blocked: email subscriber adapter not available')
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    throw new Error('rem_04_blocked: email subscriber adapter not available')
  }
}
