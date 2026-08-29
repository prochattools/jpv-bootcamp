# JPV Bootcamp Architecture Risk Register

**Status:** CURRENT A5.1 RISK REGISTER — ARCHITECTURE CLOSED; E1 FINAL CLOSEOUT COMPLETE; READY TO RESUME A6 GATE 1

**Date:** 2026-08-29

Ratings describe the risk in the current repository and the verified live
boundaries. A5.1 closes architecture ambiguity. E1 has closed the staging
topology and migration-plan evidence; remaining A6 rows are runtime/provider
acceptance or production-release requirements.

## E1 final closeout evidence

The canonical staging authority is `https://staging.jpvbootcamp.com` on
Dokploy application `clients-jpv-bootcamp-preview-wjfqfd` /
`bZllV93NqsPZAFCsqDskb`, image/commit
`0515b792f0aa6ab89db94f30e6176421e06546ae`, with
`deploymentEnv=staging`. It uses database `jpvbootcamp_staging`, schema
`jpvbootcamp`, and role `jpvbootcamp_staging_app`. The exact-SHA read-only plan
passed with 52 applied Payload migrations, zero expected pending migrations,
zero unexpected/duplicate/malformed/order anomalies, and healthy Prisma access.
The guarded administrator-member backfill linked one administrator identity.

Production is healthy and protected at
`08605e52af4abb0b1bdcdfbe6890d010c545b636` with
`deploymentEnv=production`; legacy remains isolated and frozen. The preview
hostname is still active with HTTP 200 and no redirect, serving that production
runtime. It remains a stale compatibility endpoint and is not staging
authority; retiring or repointing it is a separate change.

## E1 Gate A live topology risks

| Risk | Rating / state | Evidence | Mitigation / required owner |
| --- | --- | --- | --- |
| Preview hostname remains active outside the staging authority | High — open compatibility risk | `https://preview.jpvbootcamp.com` is HTTP 200 with no redirect and serves the production image with `deploymentEnv=production`; staging is independently healthy at `https://staging.jpvbootcamp.com` | Keep preview out of staging workflows; retire or repoint only through a separately authorized routing change with rollback proof |
| Staging database identity and migration state | Low — `E1 RESOLVED` | Staging uses `jpvbootcamp_staging` / `jpvbootcamp` / `jpvbootcamp_staging_app`; exact-SHA plan passed with 52 applied and zero expected pending migrations | Preserve the exact staging allow-list and rerun the read-only plan before future staging releases |
| Production database role has a staging-labelled name | High — observed drift | Production metadata reports role `jpvbootcamp_staging_user` | Do not rename or repair during E1; assess least privilege and rollback in Gate B |
| Preview-era references can be mistaken for current staging authority | Medium — mitigated in repository, compatibility endpoint remains | Active staging defaults use `environmentTopology`; preview hostname is explicitly documented as non-authoritative | Use the preview-to-staging inventory and reject unclassified references in later changes |

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
