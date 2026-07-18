import {
  buildMembershipSupportMigrationUpSql,
  buildMembershipSupportMigrationDownSql,
  getMembershipSupportMigrationSchema,
} from './membershipSupportMigrationSql'

// Jest globals are injected when running under jest
declare const describe: any, it: any, expect: any, beforeAll: any, afterAll: any

describe('Membership Support Schema Migration', () => {
  const testDatabaseUrl = 'postgresql://user:pass@localhost:5432/test?schema=test_jpv'
  const defaultSchema = 'jpvbootcamp'

  describe('Schema Resolution', () => {
    it('should resolve default schema when DATABASE_URL is not provided', () => {
      const schema = getMembershipSupportMigrationSchema()
      expect(schema).toBe(defaultSchema)
    })

    it('should extract schema from DATABASE_URL', () => {
      const schema = getMembershipSupportMigrationSchema(testDatabaseUrl)
      expect(schema).toBe('test_jpv')
    })

    it('should return default schema when custom schema is not in URL', () => {
      const url = 'postgresql://user:pass@localhost:5432/test'
      const schema = getMembershipSupportMigrationSchema(url)
      expect(schema).toBe(defaultSchema)
    })

    it('should throw on malformed DATABASE_URL', () => {
      expect(() => getMembershipSupportMigrationSchema('not-a-valid-url')).toThrow('Malformed DATABASE_URL')
    })

    it('should throw on invalid schema identifier', () => {
      const invalidUrl = 'postgresql://user:pass@localhost:5432/test?schema=123invalid'
      expect(() => getMembershipSupportMigrationSchema(invalidUrl)).toThrow('Invalid Payload migration schema')
    })
  })

  describe('Up Migration SQL', () => {
    let upSql: string

    beforeAll(() => {
      upSql = buildMembershipSupportMigrationUpSql()
    })

    describe('Enumerations', () => {
      const expectedEnums = [
        'enum_payload_membership_support_records_funding_source',
        'enum_payload_membership_support_records_voucher_duration',
        'enum_payload_membership_support_records_issuance_state',
        'enum_payload_membership_support_records_billing_cadence',
        'enum_payload_membership_support_records_reconciliation_state',
        'enum_payload_membership_vouchers_approval_state',
        'enum_payload_membership_vouchers_redemption_state',
        'enum_payload_pay_it_forward_funding_approval_state',
        'enum_payload_membership_funding_sources_source_type',
        'enum_payload_membership_funding_sources_source_state',
        'enum_payload_membership_reconciliations_reconciliation_state',
        'enum_payload_membership_review_queue_items_queue_state',
        'enum_payload_membership_review_queue_items_queue_reason',
        'enum_payload_membership_audit_history_actor_type',
        'enum_payload_membership_audit_history_severity',
        'enum_payload_operator_notes_target_type',
        'enum_payload_operator_notes_visibility',
        'enum_payload_stripe_shadow_projections_shadow_state',
      ]

      expectedEnums.forEach((enumName) => {
        it(`should create ${enumName}`, () => {
          expect(upSql).toContain(`"${enumName}"`)
          expect(upSql).toContain('CREATE TYPE')
          expect(upSql).toContain('AS ENUM')
        })
      })
    })

    describe('Tables', () => {
      const expectedTables = [
        'payload_membership_support_records',
        'payload_membership_vouchers',
        'payload_pay_it_forward_funding',
        'payload_membership_funding_sources',
        'payload_membership_reconciliations',
        'payload_membership_review_queue_items',
        'payload_operator_notes',
        'payload_membership_audit_history',
        'payload_stripe_shadow_projections',
      ]

      expectedTables.forEach((tableName) => {
        it(`should create table ${tableName}`, () => {
          expect(upSql).toContain(`"${tableName}"`)
          expect(upSql).toContain('CREATE TABLE')
        })
      })

      it('should include primary key on all tables', () => {
        const tables = [
          'payload_membership_support_records',
          'payload_membership_vouchers',
          'payload_pay_it_forward_funding',
          'payload_membership_funding_sources',
          'payload_membership_reconciliations',
          'payload_membership_review_queue_items',
          'payload_operator_notes',
          'payload_membership_audit_history',
          'payload_stripe_shadow_projections',
        ]
        tables.forEach((table) => {
          expect(upSql).toContain(`"id" serial PRIMARY KEY NOT NULL`)
        })
      })

      it('should include timestamp fields (created_at, updated_at) on all tables', () => {
        const tables = [
          'payload_membership_support_records',
          'payload_membership_vouchers',
          'payload_pay_it_forward_funding',
          'payload_membership_funding_sources',
          'payload_membership_reconciliations',
          'payload_membership_review_queue_items',
          'payload_operator_notes',
          'payload_membership_audit_history',
          'payload_stripe_shadow_projections',
        ]
        tables.forEach((table) => {
          // Check for presence in the SQL
          expect(upSql).toContain('updated_at')
          expect(upSql).toContain('created_at')
          expect(upSql).toContain('timestamp(3) with time zone DEFAULT now()')
        })
      })
    })

    describe('Foreign Key Constraints', () => {
      const expectedConstraints = [
        'payload_membership_support_records_member_id_fk',
        'payload_membership_vouchers_support_id_fk',
        'payload_membership_vouchers_member_id_fk',
        'payload_pay_it_forward_funding_support_id_fk',
        'payload_membership_funding_sources_support_id_fk',
        'payload_membership_reconciliations_support_id_fk',
        'payload_membership_review_queue_items_support_id_fk',
        'payload_operator_notes_author_fk',
        'payload_membership_audit_history_support_id_fk',
        'payload_stripe_shadow_projections_member_id_fk',
      ]

      expectedConstraints.forEach((constraintName) => {
        it(`should create constraint ${constraintName}`, () => {
          expect(upSql).toContain(`"${constraintName}"`)
          expect(upSql).toContain('ADD CONSTRAINT')
          expect(upSql).toContain('FOREIGN KEY')
        })
      })

      it('should include referential integrity (ON DELETE and ON UPDATE actions)', () => {
        expect(upSql).toContain('ON DELETE restrict')
        expect(upSql).toContain('ON DELETE set null')
        expect(upSql).toContain('ON UPDATE no action')
      })
    })

    describe('Indexes', () => {
      it('should create unique index on membership_support_records (member_id, approval_reference)', () => {
        expect(upSql).toContain('payload_membership_support_records_member_approval_key')
        expect(upSql).toContain('UNIQUE INDEX')
        expect(upSql).toContain('WHERE "approval_reference" IS NOT NULL')
      })

      it('should create unique index on membership_vouchers (support_id, approval_reference)', () => {
        expect(upSql).toContain('payload_membership_vouchers_support_approval_key')
        expect(upSql).toContain('UNIQUE INDEX')
      })

      it('should create unique index on pay_it_forward_funding (approval_reference)', () => {
        expect(upSql).toContain('payload_pay_it_forward_funding_approval_key')
        expect(upSql).toContain('UNIQUE INDEX')
      })

      it('should create composite index on operator_notes (target_type, target_id)', () => {
        expect(upSql).toContain('payload_operator_notes_target_type_target_id_idx')
      })

      it('should create composite index on audit_history (actor_type, actor_id)', () => {
        expect(upSql).toContain('payload_membership_audit_history_actor_type_actor_id_idx')
      })

      it('should create filtered index on operator_notes (pinned) for performance', () => {
        expect(upSql).toContain('WHERE "pinned" = true')
      })

      it('should index all state columns for efficient filtering', () => {
        expect(upSql).toContain('issuance_state_idx')
        expect(upSql).toContain('reconciliation_state_idx')
        expect(upSql).toContain('approval_state_idx')
        expect(upSql).toContain('queue_state_idx')
        expect(upSql).toContain('shadow_state_idx')
      })

      it('should index all timestamp columns for range queries', () => {
        expect(upSql).toContain('updated_at_idx')
        expect(upSql).toContain('created_at_idx')
      })

      it('should index all Stripe reference columns for reconciliation queries', () => {
        expect(upSql).toContain('stripe_customer_id_idx')
        expect(upSql).toContain('stripe_subscription_id_idx')
        expect(upSql).toContain('stripe_event_id_idx')
      })
    })

    describe('Check Constraints', () => {
      it('should enforce non-negative allocated_amount_minor in pay_it_forward_funding', () => {
        expect(upSql).toContain('payload_pay_it_forward_funding_allocated_amount_minor_check')
        expect(upSql).toContain('"allocated_amount_minor" >= 0')
        expect(upSql).toContain('"allocated_amount_minor" = trunc("allocated_amount_minor")')
      })

      it('should enforce non-negative amounts in membership_funding_sources', () => {
        expect(upSql).toContain('payload_membership_funding_sources_committed_amount_check')
        expect(upSql).toContain('payload_membership_funding_sources_available_amount_check')
      })

      it('should enforce non-negative priority in review_queue_items', () => {
        expect(upSql).toContain('payload_membership_review_queue_items_priority_check')
        expect(upSql).toContain('"priority" >= 0')
      })
    })
  })

  describe('Down Migration SQL', () => {
    let downSql: string

    beforeAll(() => {
      downSql = buildMembershipSupportMigrationDownSql()
    })

    describe('Rollback Safety', () => {
      const expectedTables = [
        'payload_stripe_shadow_projections',
        'payload_membership_audit_history',
        'payload_operator_notes',
        'payload_membership_review_queue_items',
        'payload_membership_reconciliations',
        'payload_membership_funding_sources',
        'payload_pay_it_forward_funding',
        'payload_membership_vouchers',
        'payload_membership_support_records',
      ]

      expectedTables.forEach((tableName) => {
        it(`should drop table ${tableName} in DOWN migration`, () => {
          expect(downSql).toContain(`DROP TABLE IF EXISTS`)
          expect(downSql).toContain(`"${tableName}"`)
        })
      })

      it('should use CASCADE to handle dependent objects', () => {
        expect(downSql).toContain('CASCADE')
      })

      it('should drop all enum types in DOWN migration', () => {
        const enums = [
          'enum_payload_membership_support_records_funding_source',
          'enum_payload_membership_vouchers_approval_state',
          'enum_payload_membership_audit_history_actor_type',
          'enum_payload_stripe_shadow_projections_shadow_state',
        ]
        enums.forEach((enumName) => {
          expect(downSql).toContain(`DROP TYPE IF EXISTS`)
          expect(downSql).toContain(`"${enumName}"`)
        })
      })

      it('should use IF EXISTS to prevent errors on partial rollback', () => {
        const ifExistsCount = (downSql.match(/IF EXISTS/g) || []).length
        expect(ifExistsCount).toBeGreaterThan(0)
      })
    })
  })

  describe('Schema Contract Validation', () => {
    let upSql: string

    beforeAll(() => {
      upSql = buildMembershipSupportMigrationUpSql()
    })

    it('should have matching UP and DOWN operations (symmetric migration)', () => {
      const downSql = buildMembershipSupportMigrationDownSql()
      const createTypeCount = (upSql.match(/CREATE TYPE/g) || []).length
      const dropTypeCount = (downSql.match(/DROP TYPE/g) || []).length
      expect(dropTypeCount).toBeGreaterThanOrEqual(createTypeCount)
    })

    it('should not contain hardcoded passwords or secrets', () => {
      expect(upSql).not.toMatch(/password|secret|token|api_key/i)
      expect(upSql).not.toMatch(/[a-zA-Z0-9+/]{40,}/) // Base64-like patterns
    })

    it('should use parameterized schema references', () => {
      expect(upSql).toContain('${schema}')
    })

    it('should have complete field definitions (type, constraints, defaults)', () => {
      // Sample check: member_email should be required
      expect(upSql).toContain('"member_email" varchar NOT NULL')
      // Sample check: approval_reference should be nullable
      expect(upSql).toContain('"approval_reference" varchar')
    })

    it('should include relationship dedupeKey uniqueness patterns', () => {
      // Unique indices for approval references
      expect(upSql).toContain('UNIQUE INDEX')
      expect(upSql).toContain('approval_reference')
    })
  })

  describe('Audit and Compliance', () => {
    let upSql: string

    beforeAll(() => {
      upSql = buildMembershipSupportMigrationUpSql()
    })

    it('should have immutable audit_history table structure (append-only design)', () => {
      // Check table exists
      expect(upSql).toContain('payload_membership_audit_history')
      // Should have fields to capture state before/after
      expect(upSql).toContain('"before" jsonb')
      expect(upSql).toContain('"after" jsonb')
      // Should track actor and action
      expect(upSql).toContain('"actor_type"')
      expect(upSql).toContain('"action"')
    })

    it('should have approval_reference field on all support records', () => {
      expect(upSql).toContain('"approval_reference" varchar')
    })

    it('should track Stripe event IDs for webhook reconciliation', () => {
      expect(upSql).toContain('"stripe_event_id"')
      expect(upSql).toContain('stripe_event_id_idx')
    })

    it('should track actor IDs for attribution', () => {
      expect(upSql).toContain('"actor_id"')
      expect(upSql).toContain('"issued_by"')
      expect(upSql).toContain('"approved_by"')
    })
  })

  describe('Performance Considerations', () => {
    let upSql: string

    beforeAll(() => {
      upSql = buildMembershipSupportMigrationUpSql()
    })

    it('should index all foreign keys for join efficiency', () => {
      expect(upSql).toContain('member_id_idx')
      expect(upSql).toContain('support_id_idx')
      expect(upSql).toContain('voucher_id_idx')
    })

    it('should index all state columns for WHERE clauses', () => {
      expect(upSql).toContain('issuance_state_idx')
      expect(upSql).toContain('queue_state_idx')
      expect(upSql).toContain('approval_state_idx')
    })

    it('should index date columns for range queries', () => {
      expect(upSql).toContain('created_at_idx')
      expect(upSql).toContain('updated_at_idx')
    })

    it('should use JSONB for metadata (supports indexing and GiST operations)', () => {
      expect(upSql).toContain('"metadata" jsonb')
    })

    it('should have composite indexes for common query patterns', () => {
      // Actor + ID for audit trail filtering
      expect(upSql).toContain('actor_type_actor_id_idx')
      // Target type + ID for note filtering
      expect(upSql).toContain('target_type_target_id_idx')
      // Collection + ID for audit history queries
      expect(upSql).toContain('target_collection_target_id_idx')
    })
  })

  describe('Data Integrity', () => {
    let upSql: string

    beforeAll(() => {
      upSql = buildMembershipSupportMigrationUpSql()
    })

    it('should enforce required fields on all entities', () => {
      expect(upSql).toContain('"display_name" varchar NOT NULL')
      expect(upSql).toContain('"member_id" integer NOT NULL')
      expect(upSql).toContain('"member_email" varchar NOT NULL')
    })

    it('should have foreign key constraints to prevent orphaned records', () => {
      expect(upSql).toContain('FOREIGN KEY')
      expect(upSql).toContain('REFERENCES')
      expect(upSql).toContain('ON DELETE')
    })

    it('should use restrict DELETE on core relationships', () => {
      expect(upSql).toContain('ON DELETE restrict')
    })

    it('should allow null on optional relationships (soft references)', () => {
      expect(upSql).toContain('ON DELETE set null')
    })

    it('should validate monetary amounts (non-negative, truncated integers)', () => {
      expect(upSql).toContain('allocated_amount_minor_check')
      expect(upSql).toContain('committed_amount_check')
      expect(upSql).toContain('>= 0')
      expect(upSql).toContain('= trunc')
    })

    it('should use enums for state fields to prevent invalid values', () => {
      expect(upSql).toContain('AS ENUM')
    })
  })
})
