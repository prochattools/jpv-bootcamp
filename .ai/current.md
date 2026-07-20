# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code (Sonnet 4.6) — Workbench run agent-22bad6ea-f6b6-4d5f-98ca-4c8d3d54ba4d

## Branch / HEAD
feature/course-branding-and-preview @ 44ab5ac (after this session's commit: see below)

---

## Session Summary (2026-07-20)

### Workbench run
- sourceId: `prochattools-jpv-bootcamp`
- runId: `agent-22bad6ea-f6b6-4d5f-98ca-4c8d3d54ba4d`
- Status: task-1-requirements-roadmap (Discovery) — complete in this session

### Validation completed this session
- 28/28 migration unit tests PASS
- 140/140 release tests PASS
- TypeScript: CLEAN
- git diff --check: CLEAN
- Migration file secret scan: 0 findings

---

## LIVE RECONCILIATION — complete

### Source
- Table: jpvbootcamp_staging.customer_provisioning — 21 rows (non-null normalized_email)
- Columns actually present: id, stripe_customer_id, stripe_subscription_id, wp_user_id, email, plan, status, current_plan, normalized_email (+ 5 metadata cols)
- Missing columns null-filled: stripe_price_id, billing_cadence, subscription_status (aliased from status), subscription_current_period_end

### Apply results
| Run | Run ID | processed | errors | skipped |
|-----|--------|-----------|--------|---------|
| Run 1 | migration_apply_fc8d6f35 | 21 | 0 | 0 |
| Run 2 (idempotency) | migration_apply_b138d38b | 21 | 0 | 0 |

### Staging DB state (stable across both runs)
| Table | Migration-sourced | Total | Preexisting |
|-------|-------------------|-------|-------------|
| payload_members (source='migration') | 21 | 21+ | 0+ |
| payload_billing_accounts | 21 | 23 | 2 |
| payload_subscriptions | ~17 | 22 | ~5 |
| payload_access_grants (source='migration') | 16 | 16 | 0 |

Subscription status: 17 active, 5 canceled.
Access grants: 16 active (5 rows ineligible: status=inactive/canceled or no stripe_subscription_id).

**Why totals exceed 21:** 2 preexisting billing accounts + ~5 preexisting subscriptions existed before migration.

**Idempotency proof:** Zero count change between run 1 and run 2. All upserts deterministic via sha256(email) sourceId.

**FK integrity:** All member_id, billing_account_id, subscription_id FKs verified by tool's classify-before-write pattern.

**Rollback eligibility:** Both runs have full outcome metadata. Rollback safe only for inserted rows (no preexisting row before-images available).

---

## AUTH/IDENTITY ONBOARDING — defined

- No passwords migrated (source has none)
- All 21 members need invitation/password-reset email from operator
- Email verified status NOT set by migration — operator decision required
- Duplicate emails handled by ON CONFLICT DO UPDATE (preserves existing source if not 'migration')
- wp_user_id stored in notes field as account_id=<id>; no Clerk externalId linkage automated
- Login flow: reset → Clerk sign-in → entitlement evaluator → allowed (active grant) / denied (canceled) / billing_hold (past_due)

---

## NEXT DOMAIN INVENTORY — complete

| Domain | Source table(s) | Idempotency key | PII treatment | Row count |
|--------|----------------|-----------------|---------------|-----------|
| Sponsored grants/seats/apps | sponsored_seats, sponsored_applications, sponsored_grants | sha256(stripe_payment_intent_id) | email_hash only | unknown — query needed |
| Email subscribers | email_subscribers | sha256(email) | email is PII, store controlled | unknown — query needed |
| Support requests | support_requests | source dedupe_key | normalized_email + name/question = PII | unknown — query needed |
| Partner attribution | partner_sessions, partner_clicks | session_id / click id | ip_hash, email_hash (hashed) | unknown — session TTL applies |
| Course enrollments/progress | payload_course_enrollments, payload_lesson_progress | (member_id, course_id) / (member_id, lesson_id) | no raw PII | unknown — may be zero |

All five domains require live DB query for actual row counts. Do not infer zero.

---

## REHEARSAL STATUS — BLOCKED

**Blocker:** No disposable restored copy of jpvbootcamp_staging confirmed.

**What's needed:**
1. Disposable schema (jpvbootcamp_rehearsal or similar) with staging tables restored
2. DATABASE_URL pointing to that schema
3. Migration tool guard currently requires host=100.71.31.88 or 10.0.2.4 + schema=jpvbootcamp_staging
4. **Option:** Extend tool with a rehearsal override guard (e.g., --rehearsal-override flag) for local execution

**Never rollback live staging.**

Local postgres available on port 5444 (dev, jpvbootcamp schema). Not suitable for rehearsal without provisioning rehearsal copy.

---

## Formal State
**NO-GO** for production. Staging migration complete, idempotency proven, reconciliation documented. Rehearsal on disposable copy required before GO-GO consideration.

## Next Steps
1. Operator: provision disposable rehearsal copy (restore staging tables to local postgres)
2. Extend migration tool guard to accept rehearsal override flag (or rehearsal URL pattern)
3. Execute rehearsal loop: baseline → apply → rerun → rollback → verify → reapply
4. Run pnpm test:e2e (58/58 verification)
5. Implement next-domain migration tools for sponsored grants and email subscribers

## Commits This Session
- e82d4ba migration: add reconciliation metrics and scoped rollback
- 44ab5ac docs: checkpoint migration reconciliation and rollback hardening
- (this session adds reconciliation analysis + domain inventory to handoff docs)
