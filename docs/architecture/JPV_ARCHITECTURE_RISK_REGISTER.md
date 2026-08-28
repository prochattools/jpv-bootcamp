# JPV Bootcamp Architecture Risk Register

**Status:** CURRENT A5 RISK REGISTER — HIGH-RISK ITEMS GATE A6

**Date:** 2026-08-28

Ratings describe the risk in the current repository, not a claim that the live
system is broken. `UNRESOLVED — BLOCKS A6` is an explicit stop condition.

| Risk | Rating / state | Evidence | Mitigation / required owner |
| --- | --- | --- | --- |
| Stripe, Payload, and portal active-member counts can diverge | Critical — `UNRESOLVED — BLOCKS A6` | Stripe subscription truth, Payload member records, and portal/read-model paths are not proven against one live inventory in this packet | One shared reconciliation/read model; row-level identity report; billing owner before A6 apply |
| Administrator-to-member bridge writes during portal access resolution | High — `UNRESOLVED — BLOCKS A6` | `ensureAdministratorMemberIdentity` can create/update a member/profile and link `payload_users.portalMember` while resolving access | Separate idempotent link/backfill from login; explicit admin/member identity relation; auth owner |
| Billing projection and fallback identity logic have multiple operational stores | High — `UNRESOLVED — BLOCKS A6` | Payload billing projections, Prisma `customer_provisioning`, and email fallback logic coexist | Stripe commercial truth, one local projection owner, exact-ID-first matching, review queue; billing owner |
| Direct route/page Prisma writes bypass a single domain service | High — `UNRESOLVED — BLOCKS A6` | Sponsored claim and support operations write from page/route surfaces; direct Prisma import inventory is now guarded | Move writes behind named domain services and preserve token/idempotency semantics; A6 domain owner |
| Community/member privileged accesses are broad and numerous | Medium-high — registered | Exact occurrence register contains route/service reads and writes across community/member operations | Keep actor policy and named reasons; add new occurrences only with register/test review; community owner |
| Reorder persistence has sequential rollback semantics | Medium | A4 command path performs ordered writes and attempts reversal on failure | Prove failure recovery and audit completeness before wider production integration; course owner |
| Reconciliation callback could write during dry-run | High — mitigated locally | `onCheckpoint` was callable in both modes | A5 now invokes checkpoint callbacks only in `apply`; test enforces zero dry-run callback calls |
| Historical billing branch contains a stale unique route/test delta | Medium — reviewed, not adopted | Workbench comparison found `068bbd4`; current A4 branch already has the newer dry-run/identity route contract | Preserve branch; no merge/cherry-pick until A6 review |
| Support intake and membership-support projections are split | High — `UNRESOLVED — BLOCKS A6` | Prisma `support_requests` and Payload support/read models both exist | Choose canonical review record and projection direction; support owner |
| Sponsored seats/applications/grants and Payload review screens are split | High — `UNRESOLVED — BLOCKS A6` | Prisma operational flow and Payload funding/review collections coexist | Choose seat ledger and review projection owner; prove grant idempotency; sponsored owner |
| Partner business records and click telemetry have separate authorities | Medium-high — `UNRESOLVED — BLOCKS A6` | Payload partner/affiliate collections and Prisma sessions/clicks are both operational | Document reporting join and retention/recovery rules; partner owner |
| Email delivery/outbox has Payload and Prisma surfaces | High — `UNRESOLVED — BLOCKS A6` | Resend, Payload email events, and Prisma `email_events` are used by different services | Select one outbox/delivery ledger and dedupe policy; email owner |
| Provider configuration and deployed runtime are not proven by A5 | High — `UNRESOLVED — BLOCKS A6` | A5 explicitly performs no provider mutation or live verification | A6 must verify Stripe webhook, Bunny, LiveKit, Resend, exact production SHA, and rollback |
| Browser/server-only boundary could regress | High — guarded | Server Actions are intentional client imports; provider modules are server-only | Static guard allows only named billing Server Actions and rejects new client imports |
| Design token declarations could fragment | Medium — guarded | Canonical `jpvDesignSystem.ts`, portal dark-mode override, and Payload mapping are registered | Static guard rejects unregistered `--jpv-*` declarations and competing authority |
| Duplicate administrator helper logic remains in legacy routes | Medium — registered residue | Six legacy helper files remain outside canonical `requirePortalAdmin` | Do not add new helpers; migrate legacy residue in a later bounded packet |

## A6 entry criteria

A6 may begin only when every row marked `UNRESOLVED — BLOCKS A6` has a named
decision, an environment-scoped read report, an idempotent/reversible operation
where applicable, and a reviewer-approved production gate. A5 itself does not
change the data or provider state represented by these risks.
