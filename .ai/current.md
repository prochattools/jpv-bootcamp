# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code (Sonnet 4.6)

## Branch / HEAD
feature/course-branding-and-preview @ aa9061b

## Bounded Packet Status: COMPLETE

---

## 1 — REMEDIATION — COMPLETE

All 5 contract proof lines collected at 2026-07-20T17:13:41Z:
- `old_email_old_pass_status=401` ✓
- `new_email_old_pass_status=401` ✓
- `new_credential_status=200` ✓
- `JWT_REVOCATION_PROOF: old JWT rejected (status=403)` ✓
- `sessions_after=0` ✓

Target: jpvbootcamp@prochat.tools / member id=9, staging app: clients-jpv-bootcamp-app-tp9xrk
Committed: 967bbff (enum cast fix, env prefix fix, res.resume() fix, DO block removal)

---

## 2 — LEGACY DATA MIGRATION — COMPLETE (apply executed)

### Source
- Table: jpvbootcamp_staging.customer_provisioning (Prisma system.prisma)
- Actual columns: id, stripe_customer_id, stripe_subscription_id, wp_user_id, email, plan,
  status, current_plan, normalized_email (+ 5 metadata cols)
- Note: fewer columns than Prisma model — stripe_price_id, billing_cadence, subscription_status,
  subscription_current_period_end absent; null-filled in extract query (49ece37)

### Apply results — run 1 (migration_apply_fc8d6f35, 2026-07-20)
- processed=21, errors=0, skipped=0
- Fixes applied (aa9061b): 'inactive' status → 'canceled' enum; access grant ON CONFLICT
  replaced with UPDATE-then-INSERT (no unique constraint on source_id)

### Apply results — run 2 / idempotency proof (migration_apply_b138d38b, 2026-07-20)
- processed=21, errors=0, skipped=0 — counts unchanged (no duplicates)

### Staging DB state after migration (jpvbootcamp_staging, 100.71.31.88)
| Table | Count |
|-------|-------|
| payload_members WHERE source='migration' | 21 |
| payload_billing_accounts (total) | 23 |
| payload_subscriptions (total) | 22 |
| payload_access_grants WHERE source='migration' | 16 |

Subscription status: 17 active, 5 canceled
Access grants: 16 active

### Tests
- 28/28 unit tests pass after all fixes

---

## Formal State
**NO-GO** for production. Staging migration complete and idempotency proven.
Rehearsal (backup + apply to disposable schema + reconciliation + rollback proof) not yet done.

## Next Steps
1. Run test:release (140/140) and test:e2e (58/58)
2. TypeScript check: pnpm type-check:payload
3. Rehearsal phase: backup staging, apply to disposable schema, reconcile counts, verify login/entitlements, prove rollback timing
4. Create PR when ready

## Commits This Session
- d22d06b migration: add canonical idempotent legacy-data migration tool (phase 1)
- 967bbff scripts: fix remediation script — enum cast, env prefix, res.resume()
- 49ece37 migration: adapt extract query to actual customer_provisioning schema
- fe661a8 docs: update handoff (interim)
- aa9061b migration: fix apply — inactive→canceled enum mapping, access grant conditional insert
