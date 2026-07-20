# Current Handoff

## Repo
jpv-bootcamp (feature/course-branding-and-preview)

## Tool
Claude Code (Sonnet 4.6)

## Branch / HEAD
feature/course-branding-and-preview @ 49ece37

## Bounded Packet Status: COMPLETE

### Remediation — DONE
All 5 contract proof lines collected from --execute run at 2026-07-20T17:13:41Z:
- `old_email_old_pass_status=401` ✓
- `new_email_old_pass_status=401` ✓
- `new_credential_status=200` ✓
- `JWT_REVOCATION_PROOF: old JWT rejected (status=403) after password reset and session deletion` ✓
- `sessions_after=0` ✓

Target: jpvbootcamp@prochat.tools / member id=9
Method: email rotation (STEP1) → forgot-password (STEP2) → token extract (STEP3) → reset (STEP4) → session delete (STEP5) → 3 auth proof tests (STEP6-8) → JWT revocation proof (STEP8B)

Script fixes committed at 967bbff:
- COALESCE(account_status,'null') → COALESCE(account_status::text,'null') (enum cast)
- node -e "..." VAR="$x" → VAR="$x" node -e "..." (env prefix not positional arg, 5 occurrences)
- Added res.resume() to 4 status-only response handlers (prevented socket hang)
- Removed broken DO $$ GET DIAGNOSTICS $$ block (ROW_COUNT unavailable cross-statement)

Temp files cleaned up on dokploy server (/tmp/.remcreds, /tmp/run-remediation.sh, etc.)

### Migration Phase 1+2 — DONE
Script: scripts/migration/legacyMigration.ts (committed d22d06b, fixed 49ece37)
Tests: 28/28 passing

Extract run against staging (2026-07-20):
- source_rows=21, null_emails=0, duplicate_emails=0

Dry-run against staging (2026-07-20):
- total=21, with_billing=21, with_subscription=21, with_grant=16
- No writes performed, no PII in output

Schema fix (49ece37): customer_provisioning has fewer columns than Prisma model. Extract query
adapted: null-fill stripe_price_id / billing_cadence / payment_status / commitment_status /
subscription_current_period_end; map wp_user_id → accountId, status → subscriptionStatus.

## Formal State
Still **NO-GO** for production. Staging remediation complete. Migration extract+dry-run complete.
Apply mode not yet run (requires explicit approval).

## Next Steps (if resuming)
1. Run test:release (140/140) and test:e2e (58/58) to verify no regressions
2. TypeScript check: pnpm type-check:payload
3. Decide whether to run migration --mode apply (requires explicit approval)
4. Create PR when ready

## Commits This Session
- 967bbff scripts: fix remediation script — enum cast, env prefix, res.resume()
- 49ece37 migration: adapt extract query to actual customer_provisioning schema
