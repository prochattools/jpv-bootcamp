# Core Go-Live Decision

- Decision ID: `core-go-live`
- Current status: `NO-GO`
- Decision owner role: `Release operator`
- Approver role: `Formal go-live approver`
- Implementation owner role: `Release operator`
- Rollback owner role: `Release rollback owner`
- Classification: `mixed`
- Release impact: `Final release decision record.`
- Depends on: `programme-content-publication, table-plan-to-free, account-column-rename, staging-migration-approval, rollback-readiness, provider-verification, staging-smoke`
- Required evidence summary: `docs/release/GO_NO_GO_CHECKLIST.md`, `pnpm staging:decision-readiness`, and formal approval evidence`

## Identity

- Release candidate commit: `c593a94` (local HEAD `c593a94`; staging deployed at `d235c5a`)
- Decision date: `2026-07-21` (evidence collection date; formal approval date TBD)
- Decision owner: `Release operator` — [named operator required before GO]
- Approvers: `[TO BE FILLED DURING FORMAL APPROVAL — client + technical approver required]`
- Rollback owner: `[TO BE FILLED DURING FORMAL APPROVAL]`
- Monitoring owner: `[TO BE FILLED DURING FORMAL APPROVAL]`
- Communication owner: `[TO BE FILLED DURING FORMAL APPROVAL]`

## Gate matrix

| Decision | Required state before `GO` | Current state (2026-07-21) |
| --- | --- | --- |
| programme-content-publication | approved | PENDING — awaiting client content |
| table-plan-to-free | approved | PENDING — awaiting approval |
| account-column-rename | approved | PENDING — awaiting approval |
| staging-migration-approval | approved | PENDING — unapproved; 3 schema migrations unapplied |
| rollback-readiness | approved | DOCUMENTED — repository checklist complete; staging rollback evidence requires operator capture post-apply |
| provider-verification | **VERIFIED (2026-07-21)** | Stripe TEST ✓ (product + prices + portal + webhook), Resend ✓ (jpvbootcamp.com verified), Bunny CDN ✓ (all 5 vars, library API 200); Payload/admin authenticated session requires operator login |
| staging-smoke | **VERIFIED (2026-07-21)** | HTTP 15/15 PASS + browser 40/40 PASS (desktop + mobile Chromium via playwright-staging.config.ts) |
| REM-01 invitation | **VERIFIED (2026-07-21)** | 21-member cohort confirmed; invitation token issued and sent to info@prochat.tools (Resend ID ea53092c, token in DB confirmed); /set-password route 200; completion API rejects bad tokens correctly; idempotency PASS |
| local release suite | **VERIFIED (2026-07-21)** | 145/145 at HEAD `32874a2` |
| local e2e suite | **VERIFIED (2026-07-21)** | 58/58 desktop + mobile Chromium |

## Verified evidence summary (2026-07-21)

All automatable gates are now verified. Remaining blockers are exclusively operator/client decisions:

| Evidence item | Status |
| --- | --- |
| `pnpm test:release` 145/145 | ✓ PASS |
| `pnpm test:e2e` 58/58 | ✓ PASS |
| `pnpm staging:provider-simulation` 10/10 | ✓ PASS |
| `pnpm staging:smoke-simulated` 5/5 | ✓ PASS |
| `pnpm staging:decision-readiness` | ✓ DECISION-READY, EXTERNAL APPROVALS PENDING |
| Stripe TEST product/prices/portal/webhook | ✓ VERIFIED |
| Resend jpvbootcamp.com domain | ✓ VERIFIED |
| Bunny CDN all 5 credentials | ✓ VERIFIED |
| Staging HTTP smoke 15/15 | ✓ VERIFIED |
| Staging browser smoke 40/40 | ✓ VERIFIED |
| REM-01 cohort (21 members) | ✓ DRY-RUN CONFIRMED |
| REM-01 invitation token + send | ✓ VERIFIED (info@prochat.tools, Resend ID ea53092c) |
| REM-01 /set-password route | ✓ 200 with valid token |
| REM-01 completion API bad-token rejection | ✓ returns invalid_or_expired_token |
| REM-01 idempotency | ✓ PASS |

## Unresolved risks

- 3 schema migrations unapplied (`remove_table_plan`, `rename_account_identity_columns`, `membership_support_schema`); no apply authorization received.
- 20 remaining member invitation applies (info@prochat.tools only authorized); explicit per-member authorization required.
- Authenticated member portal session proof (login with issued token → /portal access) requires info@prochat.tools to complete set-password flow; confirmation pending.
- Payload/admin authenticated session verification requires operator login.
- Client content outstanding; programme remains preview-only.
- M2 remains unstarted and post-core.
- Production remains untouched; production cutover requires separate explicit production authorization.

## Decision

- GO: `[REQUIRES FORMAL OPERATOR + CLIENT SIGN-OFF]`
- CONDITIONAL GO: `[REQUIRES FORMAL OPERATOR + CLIENT SIGN-OFF]`
- NO-GO: `Current default — pending migration approval, content approval, and formal review`
- Conditions for GO: All four pending items below must be resolved before any GO decision:
  1. Programme content approved or placeholder explicitly accepted by client
  2. table-plan-to-free + account-column-rename decisions approved by client
  3. Staging migration apply authorized, executed, and rollback evidence captured
  4. Named operator + approver + rollback owner + monitoring owner filled in above

## Approval record

- Approval decision: `[REQUIRES FORMAL OPERATOR + CLIENT SIGN-OFF]`
- Approved / rejected by: `[REQUIRES NAMED APPROVER]`
- Approval timestamp: `[TO BE FILLED DURING FORMAL APPROVAL]`
- Evidence reference: `docs/release/GO_NO_GO_CHECKLIST.md` (updated 2026-07-21 with full evidence)
- Execution owner confirmation: `[TO BE FILLED DURING FORMAL APPROVAL]`
- Rollback owner confirmation: `[TO BE FILLED DURING FORMAL APPROVAL]`
