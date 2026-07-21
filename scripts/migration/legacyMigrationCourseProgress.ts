/**
 * REM-07: Course enrollment/progress reconciliation (UNSAFE - NEEDS DESIGN).
 *
 * Status: BLOCKED - Same-table migration design required
 *
 * This adapter is a stub that refuses to run.
 * The core issue: source and destination are the same tables
 *   - Source: payload_course_enrollments, payload_lesson_progress (in legacy schema)
 *   - Destination: payload_course_enrollments, payload_lesson_progress (Payload schema)
 *
 * If these are truly the same tables in different schemas, this is safe.
 * If they're the same table, the migration must prove:
 *   1. Read-only snapshot taken before any writes
 *   2. No concurrent writes to the table during migration
 *   3. Exact idempotency guarantees for re-run safety
 *   4. Safe rollback (preserve preexisting rows, only delete what we inserted)
 *
 * Before implementation, define:
 *   1. Source schema (legacy schema name, or same as destination?)
 *   2. Transformation strategy (if any - status mapping, etc.)
 *   3. Conflict resolution (update vs. skip preexisting)
 *   4. Rollback strategy (audit table with before-images)
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

export class CourseProgressAdapter implements DomainMigrationAdapter {
  domainName = 'course_progress'

  async extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]> {
    throw new Error(
      'rem_07_blocked: course progress adapter unsafe. ' +
        'Same-table migration (source=destination) must prove safe isolation. ' +
        'See docs/MIGRATION_ROADMAP.md for design requirements.',
    )
  }

  async validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }> {
    return {
      passed: false,
      reasons: [
        'rem_07_blocked: course progress adapter unsafe',
        'source_destination_same_table_requires_design',
      ],
    }
  }

  transformRecord(source: any): TransformedDomainRecord[] {
    throw new Error('rem_07_blocked: course progress adapter unsafe')
  }

  async detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string }> {
    throw new Error('rem_07_blocked: course progress adapter unsafe')
  }

  async applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<'inserted' | 'updated' | 'unchanged' | 'not_applicable'> {
    throw new Error('rem_07_blocked: course progress adapter unsafe')
  }

  async reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>> {
    throw new Error('rem_07_blocked: course progress adapter unsafe')
  }

  async rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number }> {
    throw new Error('rem_07_blocked: course progress adapter unsafe')
  }
}
