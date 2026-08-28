# JPV Bootcamp Architecture Risk Register

**Status:** CURRENT A5.1 RISK REGISTER — ARCHITECTURE CLOSED; E1 GATE A BLOCKED

**Date:** 2026-08-28

Ratings describe the risk in the current repository, not a claim that the live
system is broken. A5.1 closes architecture ambiguity; remaining A6 rows are
runtime evidence requirements only.

## E1 Gate A live topology risks

| Risk | Rating / state | Evidence | Mitigation / required owner |
| --- | --- | --- | --- |
| Transitional preview runtime is still the public staging origin | Critical — `E1 BLOCKED` | `https://preview.jpvbootcamp.com` is healthy with `deploymentEnv=preview`; `https://staging.jpvbootcamp.com` returns 404 | Provision and verify the staging hostname/routing in Gate B before retiring preview; keep production deny-lists |
| Staging database identity is transitional and migration state mismatches the repository | Critical — `E1 BLOCKED` | Current runtime uses `jpvbootcamp_preview` / `jpvbootcamp_staging`; 46 Payload and 26 Prisma rows do not cover all registered migrations | Review the separate `jpvbootcamp_staging` target, reconcile state read-only, then apply only under an exact Gate B authorization |
| Production database role has a staging-labelled name | High — observed drift | Production metadata reports role `jpvbootcamp_staging_user` | Do not rename or repair during E1; assess least privilege and rollback in Gate B |
| Preview-era references can be mistaken for current staging authority | High — mitigated in repository | Active staging defaults now use `environmentTopology`; historical and immutable references remain | Use the preview-to-staging inventory and reject unclassified references in later changes |

| Risk | Rating / state | Evidence | Mitigation / required owner |
| --- | --- | --- | --- |
| Stripe, Payload, and portal active-member counts can diverge | Critical — `A6 LIVE-EVIDENCE REQUIREMENT` | The shared membership read model and identity report define the comparison, but this packet performs no live inventory | Run one exact-environment, read-only Stripe-to-Payload/member report; apply only after explicit review and guarded authorization |
| Administrator-to-member bridge writes during portal access resolution | High — `RESOLVED — architecture closed` | `resolveAdministratorMemberIdentity` is read-only; `ensureAdministratorMemberIdentity` is explicit provisioning/backfill only | Keep admin/member identities distinct; A6 must prove live actor behavior and perform any authorized backfill separately |
| Billing projection and fallback identity logic have multiple operational stores | High — `RESOLVED — architecture closed` | Payload billing collections are the canonical local projection; Prisma `customer_provisioning` is operational/legacy compatibility; Stripe is commercial truth | Preserve Stripe → Payload direction, exact-ID-first matching, review-required unknowns, and manual hold precedence; A6 verifies live consistency |
| Direct route/page Prisma writes bypass a single domain service | High — `RESOLVED — architecture closed` | Reviewed support and sponsored route/page writes now call named server-only persistence services; path-aware guard is registered | Preserve transport → service layering and idempotency; A6 runs regression proof |
| Community/member privileged accesses are broad and numerous | Medium-high — registered | Exact occurrence register contains route/service reads and writes across community/member operations | Keep actor policy and named reasons; add new occurrences only with register/test review; community owner |
| Reorder persistence has sequential rollback semantics | Medium | A4 command path performs ordered writes and attempts reversal on failure | Prove failure recovery and audit completeness before wider production integration; course owner |
| Reconciliation callback could write during dry-run | High — mitigated locally | `onCheckpoint` was callable in both modes | A5 now invokes checkpoint callbacks only in `apply`; test enforces zero dry-run callback calls |
| Historical billing branch contains a stale unique route/test delta | Medium — reviewed, not adopted | Workbench comparison found `068bbd4`; current A4 branch already has the newer dry-run/identity route contract | Preserve branch; no merge/cherry-pick until A6 review |
| Support intake and membership-support projections are split | High — `RESOLVED — architecture closed` | Prisma `support_requests` is the intake/review ledger; Payload membership-support records are one-way projections | Keep review status in Prisma and preserve the named persistence boundary; A6 verifies projection/retry behavior |
| Sponsored seats/applications/grants and Payload review screens are split | High — `RESOLVED — architecture closed` | Prisma owns seat/application/grant transactions; Payload owns administrative projection; claim service is token-bound and idempotent | Preserve the transaction and review projection; A6 verifies live funded-seat and recipient lifecycle evidence |
| Partner business records and click telemetry have separate authorities | Medium-high — `RESOLVED — architecture closed` | Payload owns business records; Prisma retains hashed telemetry with explicit account/partner/application joins | Keep telemetry non-authoritative and retention-bounded; A6 verifies reporting joins if in release scope |
| Email delivery/outbox has Payload and Prisma surfaces | High — `RESOLVED — architecture closed` | Payload email events own current enqueue/dedupe/retry; Prisma email events remain isolated legacy compatibility/history | Prevent double-send; A6 verifies current producer routing, worker delivery, and provider status |
| Provider configuration and deployed runtime are not proven by A5.1 | High — `A6 LIVE-EVIDENCE REQUIREMENT` | A5.1 explicitly performs no provider mutation or live verification | A6 must verify Stripe webhook, Bunny, LiveKit, Resend, exact production SHA, and rollback |
| Browser/server-only boundary could regress | High — guarded | Server Actions are intentional client imports; provider modules are server-only | Static guard allows only named billing Server Actions and rejects new client imports |
| Design token declarations could fragment | Medium — guarded | Canonical `jpvDesignSystem.ts`, portal dark-mode override, and Payload mapping are registered | Static guard rejects unregistered `--jpv-*` declarations and competing authority |
| Duplicate administrator helper logic remains in legacy routes | Medium — registered residue | Six legacy helper files remain outside canonical `requirePortalAdmin` | Do not add new helpers; migrate legacy residue in a later bounded packet |

## A6 entry criteria

A6 may begin because the architecture rows have named decisions. It remains
blocked from any apply or release action until the live-evidence rows have an
exact environment, read-only inventory, deployed-SHA/runtime proof, applicable
provider checks, and reviewer-approved production gate. A5.1 changes no data
or provider state represented by these risks.
