# JPV Bootcamp Mighty Migration Implementation Plan

## CURRENT FINAL PRE-CUTOVER MANIFEST + READ-ONLY REHEARSAL — 2026-09-11

`INTEGRATION LOGIC: READY`
`REAL MEMBER MIGRATION: NOT STARTED`
`CURRENT GATE: FINAL ROLE / IDENTITY / OVERLAP MANIFEST + READ-ONLY CUTOVER REHEARSAL`

The complete live rehearsal now reads the 17 active Stripe subscriptions and
the complete 15-member Mighty inventory, producing 17 deterministic rows:
17 allowed, 0 denied, 0 ambiguous, 0 unmatched, zero purchases, and
`mutationPerformed=false`. It supersedes the old local `customerProvisioning`
partial audit as the cutover population source. See
`docs/migration/MIGHTY_FINAL_PRE_CUTOVER_MANIFEST_2026-09-11.md` for the exact
manifest and future normalization procedure. Unknown roles, privileged
identities, extra Spaces, alternate Plans, ambiguous identities, and provider
uncertainty fail closed. The scheduler remains disabled and no real member has
been migrated.

## CURRENT INTEGRATION HARDENING / TEST IDENTITIES ONLY — 2026-09-10

Phase D and E0 are complete. This branch is now limited to hardening the
Stripe → Mighty implementation and proving synthetic lifecycle, ordering,
identity, privilege, overlap, and reconciliation behavior. Live mutations are
limited to the explicitly authorized test identities
`westhoek@hotmail.com`, `steve@yeshua.academy`, and `info@prochat.tools`; the
ordinary identity remains restored/allowed.

No real member population is being migrated or normalized. The historical
`Missaquadri@gmail.com` proposal is NOT AUTHORIZED and NOT EXECUTED. Stripe,
the production scheduler, deployment, and merge remain untouched. Unknown
provider roles, Host/Admin identities, unexpected Spaces, and alternate Plans
fail closed to review.

**Status:** Feature branch reconciled with the production hotfix; bounded live provider acceptance passed; cutover remains separately unauthorized
**Date:** 2026-09-10
**Branch:** `feature/mighty-stripe-migration`  
**Current branch HEAD:** pushed validation tip (see repository log)
**Production baseline tag:** `pre-mighty-migration-2026-09-09`

## Current Phase E0 read-only reconciliation — 2026-09-10

Phase E0 is complete as a read-only production reconciliation and controlled
migration preparation gate. The feature branch is
`feature/mighty-stripe-migration` at the pushed validation tip,
matching `origin`; only unrelated `newrelic_agent.log` is dirty. No member
migration, Stripe mutation, scheduler enablement, merge, or production deploy
was performed.

The authoritative deployed identity-dry-run ran in live Stripe mode and found
17 active subscriptions, all matched to active Payload members:
`ALLOWED: 17`, `DENIED: 0`, `AMBIGUOUS: 0`, `UNMATCHED: 0`. The current
Mighty candidate manifest is:

| Classification | Identities |
| --- | --- |
| `PHASE_D_CANARY_COMPLETE` | `westhoek@hotmail.com` (Mighty `41580317`) |
| `OWNER_OR_ADMIN_EXCLUDED` | `steve@yeshua.academy` (Mighty `41580680`) |
| `ELIGIBLE_ORDINARY_BATCH_CANDIDATE` | `Missaquadri@gmail.com` (`41567828`), `adaumoudit@gmail.com` (`41566725`), `amechiclarangozi2022@gmail.com` (`41567964`), `happyalamss@gmail.com` (`41566259`), `ronyaa@live.co.uk` (`41568214`), `Katherinecd7@yahoo.com` (`41585608`) |
| `PRIVILEGED_OR_EXCEPTION_ACCESS_REVIEW` | `tosinotubanjo@gmail.com` (`41582168`), because of extra `FIRST FOUNDATION` Space |
| `IDENTITY_MISMATCH_REVIEW` | `anita13steve@gmail.com`, `info@yeshua.academy`, `kem.okupa@gmail.com`, `marek_bed@yahoo.com`, `nsgonza2@gmail.com`, `prince.okoroego@gmail.com`, `samuel.roy.edward.hill@gmail.com`, `vimbaimt@gmail.com` |
| `ALREADY_PLAN_CONTROLLED` (additional) | None; the two current Plan-controlled identities are classified above as canaries/exceptions |
| `OTHER_PLAN_OVERLAP_REVIEW` | None observed |
| `DUPLICATE_IDENTITY_REVIEW` | None observed; provider-masked prefix collisions are not duplicate proof |

The historical proposed next batch was exactly one unmodified identity:
`Missaquadri@gmail.com` / Mighty `41567828`. It is explicitly NOT AUTHORIZED
and NOT EXECUTED under the current hardening gate. Any future execution
requires fresh owner authorization naming that exact identity and approving a
single Plan `2000039` grant plus independent reads.
The two old redacted unmatched records cannot be named retrospectively, but
the current authoritative report resolves the live set with zero unmatched and
zero ambiguous records. Missing Mighty identities, alternate Plans, extra
Spaces, and privilege exceptions remain manual-review stops.

## Current reconciliation and security status — 2026-09-10

- `origin/main` and the live production deployment are now at
  `5d0f318eb4c4b178364dcdbbb17670d101abb930`. The feature branch contains
  that hotfix through merge commit `6b34c451`; the obsolete homepage sentence
  is absent from the source, and the Mighty implementation commits remain
  intact. The feature branch was not deployed or merged.
- The bounded exposure evidence identifies only
  `MIGHTY_ADMIN_API_TOKEN` and `MIGHTY_ACCESS_SYNC_WORKER_SECRET` as the
  relevant secret-bearing names requiring rotation. The Dokploy API key was
  used only as a local request credential and was not present in the returned
  environment payload; no value is recorded here. The replacement Mighty
  token is stored in production Dokploy and authenticated a read-only
  members request with HTTP 200. A fresh 64-character worker secret is stored
  in production Dokploy. No GitHub `production-mighty-sync` environment or
  workflow secret exists yet.
- The previously configured Mighty API key and the two intermediate replacement
  keys were revoked in Mighty Admin → Settings → API Keys. The final
  replacement is stored in production Dokploy and passed the read-only check.
  This goal forbids a production deploy, so the running image remains the
  prior non-Mighty production image; the next authorized deployment must repeat
  the harmless read-only members check. Do not enable the scheduler as part of
  that action.
- Production automatic processing remains disabled: no
  `MIGHTY_ACCESS_SYNC_ENABLED` repository variable exists and no
  `production-mighty-sync` environment is configured. The older six-record
  preparation snapshot was `ALLOWED: 4`, `DENIED: 0`, `AMBIGUOUS: 0`,
  `UNMATCHED: 2`; it is historical and superseded by the Phase E0 live result
  above.
- The owner read-only check still finds exactly one `info@prochat.tools`
  identity with Plan `2000039` present and no other Plan overlap. The owner
  remains restored/allowed. No real student or member population was changed.
- The ordinary-member pilot for the explicitly authorized
  `westhoek@hotmail.com` identity is complete and passed. The exact sequence,
  provider evidence, and remaining overlap-audit procedure are in
  `docs/migration/MIGHTY_MANUAL_ACCESS_NORMALIZATION.md`. No batch migration
  or automated revocation is authorized by this canary.

- The explicitly authorized second administrator canary for
  `steve@yeshua.academy` passed against the same production Network. The
  read-only lookup reused exactly one existing Mighty identity, stable member
  ID `41580680`, with `member_type=full`, no target or other Plan membership,
  no purchase rows, and five direct Space memberships. The provider did not
  expose a definitive Host/Admin role field in the member or Space responses;
  the direct Space memberships establish an administrator-access bypass that
  must not be removed during a Plan test.
- Plan `2000039` was granted and independently verified. A repeated grant
  returned the provider's duplicate-assignment HTTP 422, while the
  independent read remained exactly one target Plan membership and zero other
  Plans; this proves idempotent state rather than duplicate access. Plan-only
  revoke returned HTTP 204 and independently showed zero target Plan
  memberships. Restore returned HTTP 200 and independently restored exactly
  one target Plan membership. The member ID and five direct Space memberships
  remained unchanged; no Host/Admin, Network, Space, profile, content, or
  history operation was performed.
- Effective Network denial was not tested because direct administrator Space
  access is an independent bypass. The administrator remains fully restored
  and allowed. No duplicate account, welcome email, student/member-population
  mutation, Stripe mutation, deployment, merge, or scheduler enablement
  occurred. The next gate is the separately authorized controlled migration
  batch prepared by Phase E0; no batch execution is authorized by this record.

## Current acceptance evidence — 2026-09-10

- The owner explicitly authorized Phase C against `info@prochat.tools`, the
  existing owner-canary identity. The pre-canary read-only inspection found
  exactly one matching Mighty identity, `member_type=full`, the target Plan
  already present, no other Plan or purchase overlap, and six direct Space
  memberships. The provider response did not expose a definitive network
  Host/Admin role field, so the role is recorded as
  `ADMIN_ROLE_UNVERIFIED_BY_PROVIDER_MEMBER_RESPONSE`.
- The owner-authorized Phase C Plan canary passed in production: the existing
  identity was reused, the grant was independently verified, repeat grant was
  idempotent, Plan removal was independently verified, repeat revoke was safe,
  and Plan `2000039` was restored and independently verified. No welcome email,
  duplicate identity, privilege change, Network removal, Space removal, or
  real-member mutation occurred.
- Effective Network denial was not tested and is classified as
  `NOT_APPLICABLE_FOR_ADMIN_ROLE_OR_NOT_TESTED` because the account retains six
  direct Space memberships and the provider did not expose a definitive
  Host/Admin role classification. The canary proves only the target
  Plan-controlled lifecycle for this account.
- A second administrator canary then passed for the explicitly authorized
  existing identity `steve@yeshua.academy` (Mighty member ID `41580680`). The
  identity was found through the provider's exact email lookup and reused;
  the read-only precheck found no Plan or purchase membership and five direct
  Space memberships. The provider again exposed `member_type=full` but no
  definitive Host/Admin role field. The grant was verified, the repeated
  grant returned duplicate-assignment HTTP 422 without creating a second Plan
  membership, Plan-only revoke was verified absent, and restore was verified
  present. All five direct Space memberships and the member ID were preserved.
- Because direct administrator Space access bypasses the target Plan, this
  canary did not claim effective Network denial. Host/Admin privileges and
  direct access were preserved, and the final state is restored/allowed with
  exactly one Plan `2000039` membership. No duplicate account, welcome email,
  profile/content/history mutation, student/member-population mutation,
  Stripe mutation, deployment, merge, or scheduler enablement occurred.
- Phase D was then completed for `westhoek@hotmail.com`. The live Stripe
  entitlement was `ALLOWED`; the existing Mighty member ID `41580317` was a
  Full Member with Direct Network access, five direct Spaces, no Plans, and no
  purchases. The Plan's admin settings exposed Network access only. Mighty
  documents that Network access includes the entire Network and all Spaces,
  so the plan scope was classified `PLAN_SCOPE_COMPLETE` for this member.
- The production-shaped application acceptance reused the existing identity,
  granted Plan `2000039`, independently verified access and exactly one target
  membership, and confirmed full membership, profile fields, and five Spaces.
  A repeated grant returned duplicate-assignment HTTP 422 while the target
  membership remained exactly one. No direct Network membership was removed
  separately.
- Plan-only revoke returned HTTP 204 and removed active Network/member/Space
  visibility, causing the corresponding reads to return 404. This is the
  expected effective denial for a Network-access Plan, not a blocker. A
  repeated denial was safe. Without manually re-adding direct/full membership,
  the normal application ALLOWED path handled the inactive-member 404 by
  re-provisioning with `member_type=full` and `send_welcome_email=false`,
  returned the original ID `41580317`, re-granted the Plan, and independently
  verified the same account, full membership, five Spaces, one target Plan,
  and zero purchases. The deny → restore cycle was repeated once with the same
  result and no duplicate identity.
- The previous direct-membership-only normalization blocker is superseded: it
  required preserving a separate direct Network source while denied, which is
  not the business requirement. The historical `network_membership` probe that
  changed `full` to `limited` remains evidence, but that operation is not part
  of migration. Other Plan overlaps and exceptional Space/staff/admin access
  remain separately audited risks. No other member, Stripe object, deployment,
  merge, or scheduler was mutated.
- The six-record unresolved provisioning snapshot in this historical acceptance
  section is retained for auditability only. The current authoritative
  production identity-dry-run is recorded in the Phase E0 section above.
- A second scheduler safety check found no
  `MIGHTY_ACCESS_SYNC_ENABLED` repository variable and no visible
  `production-mighty-sync` environment variable endpoint. Production automatic
  processing therefore remains disabled.

- The bounded live acceptance passed against the existing JPV Mighty Network
  for the authorized operator-controlled test identity only. It reused the
  existing member, verified grant by a separate read, proved repeated-grant
  idempotency, verified revoke by a separate read, proved repeated revoke was
  safe, restored access, and verified the final access state. The identity is
  left restored in Plan `2000039`.
- The acceptance initially exposed that this non-paid access-only Plan has no
  purchase row. The provider client now verifies member Plan membership through
  `/members/{member_id}/plans` and revokes through the documented
  `/plans/{plan_id}/members/{id}/` DELETE endpoint. No provider billing was
  introduced.

- The implementation branch is pushed to `origin` through
  `873c8f82`.
- The annotated baseline tag is pushed to `origin` and resolves to
  `a287800735d465a41ad9e45d2c7914ab9cc34a26`.
- The owner has manually created the hidden, non-paid, access-only JPV member
  Plan. The application does not create or configure this provider object.
- A read-only provider lookup using the production Dokploy credentials
  authenticated successfully and confirmed Plan `2000039` as `JPV Member
  Access`, hidden, and non-paid. No credential or Network ID is recorded in
  Git.
- Fresh production Dokploy inspection confirms all six required Mighty values
  are present. The safe public values are the Admin API base
  `https://api.mn.co/admin/v1`, Network ID `24903412`, Plan ID `2000039`, and
  the canonical `jpv-community.mn.co/sign_in` URL. Secret values were not
  printed or committed.
- An earlier corrected read-only production roster audit recorded 6 active
  provisioning records with missing `subscriptionStatus`; that snapshot is
  historical and is superseded by the Phase E0 live identity report above.
- The local `.env` and `.env.production` contain no configured Mighty values;
  only `.env.example` contains placeholders. No secret values are recorded.
- The guarded real-network command passed with the production mutation guard
  and left the authorized test identity restored. No real student was touched.
- The read-only production roster bridge remains available for the controlled
  procedure. Its earlier six-record result is historical; no roster was
  exported or migrated in Phase E0.
- The read-only configuration check is available as `pnpm mighty:config-check`.
  It reports only PRESENT/MISSING/INVALID states, never secret values, and
  identifies a configured Plan ID as requiring provider lookup rather than
  treating it as proof that a real access Plan exists. It does not report
  acceptance readiness until that provider verification is complete.
- The worker route has local runtime coverage for missing-secret,
  unauthorized-token, and malformed-request fail-closed behavior. No worker
  request was sent to a deployed application.
- The read-only `pnpm mighty:manual-access-audit` command is implemented. It
  compares all Mighty members, member Plan memberships, and purchases with
  Stripe-entitled records and reports aggregate direct/overlapping-access risk
  without mutation. Its earlier six-record local-projection result is
  historical; the authoritative Phase E0 identity result is recorded above.
- Mighty API requests include the required identifying `User-Agent` header for
  the provider’s bot-protection boundary.

## Canonical silent-build rollout model

This is a canary build phase. Plan `2000039` is the controlled access
abstraction, but existing real Mighty members remain on their current
manual/direct access until the later migration stages are explicitly approved.

### Phase A — Silent build

- Keep Plan `2000039` limited to controlled canary identities.
- Leave the existing real-member experience unchanged.
- Do not normalize, revoke, or otherwise modify the real member population.

### Phase B — Owner acceptance

- `info@prochat.tools` is the first canary.
- Verify the application-level ALLOWED → DENIED → ALLOWED lifecycle and final
  restored Plan access. This phase is complete.

### Phase C — Administrator canary

- Use the controlled procedure in
  `docs/migration/MIGHTY_ADMIN_CANARY_PROCEDURE.md`.
- Use only administrator identities explicitly supplied and authorized by the
  owner. Do not infer identities from repository or database data.
- This phase passed for the explicitly authorized owner account. It proves the
  target Plan-controlled lifecycle only; effective Network denial is not a
  valid administrator result. Phase D has since completed for the authorized
  ordinary canary, and Phase E0 has prepared—but not executed—the next
  controlled batch.

### Phase D — Member migration

- After administrator acceptance, migrate existing Stripe-entitled members
  one at a time or in small controlled batches.
- Resolve Stripe entitlement, detect Network/Plan/Space access, grant and
  verify Plan `2000039`, and record the member as `PLAN_CONTROLLED`. Do not
  separately normalize ordinary legacy direct Network membership.
- Use stop-on-error, resumable checkpoints, idempotent retries, and aggregate
  audit evidence. The bounded Phase D canary is complete; the controlled batch
  procedure remains separately authorized and unexecuted.
- Phase D was completed only for the explicitly authorized ordinary member
  `westhoek@hotmail.com`. Stripe resolved one live JPV customer/subscription
  as `ALLOWED` with a paid latest invoice and current period through
  `2026-09-23`. The existing Mighty `Full Member` identity `41580317` was
  reused; it had Direct Network access, five direct Spaces, no Plans, and no
  purchases. Plan `2000039` was configured for Network access only. Mighty
  documents that Network access includes the entire Network and all Spaces, so
  the plan scope is `PLAN_SCOPE_COMPLETE` for this member.
- The Plan grant returned HTTP 200 and was independently verified. A repeated
  grant returned the exact duplicate-assignment HTTP 422
  (`User already has access to this plan`) and remained exactly one target
  membership. Plan-only revoke returned HTTP 204, removed active
  Network/member/Space visibility, and made the corresponding reads return
  HTTP 404. This matches Mighty’s documented behavior for removing a
  non-paid Network-access Plan and is the desired effective denial. Repeated
  denial was safe.
- Without manually re-adding direct/full membership, the normal application
  ALLOWED path recovered the inactive member using stable ID plus the
  same-identity re-provision fallback with `member_type=full` and
  `send_welcome_email=false`. It returned the original member ID, re-granted
  the Plan, and independently verified full membership, profile fields, five
  Spaces, one target Plan, and zero purchases. A second deny → restore cycle
  passed with the same ID and no duplicate identity.
- The previous direct-membership-only normalization blocker is superseded as
  an unnecessary requirement. The historical `network_membership` probe that
  changed `full` to `limited` remains evidence, but that operation is not part
  of migration. No other member, Stripe object, deployment, merge, or
  scheduler was mutated.

### Phase E — Automation enablement

- Keep production automation disabled until the real paid membership is
  Plan-controlled and alternate access routes have been reviewed.
- Only after Phases A–D, website/cutover verification, and production
  configuration approval may `MIGHTY_ACCESS_SYNC_ENABLED=true` be introduced.

## Guardrails

This plan preserves the current production Stripe billing system and makes no
production deployment, production database mutation, provider production-object
creation, subscription recreation, or merge authorization. Stripe remains the
only billing authority. Mighty access is a downstream entitlement projection.

No invitation workflow is used for automatic provisioning. The application
creates a Mighty member directly when absent, grants the existing access Plan,
and sends the existing JPV welcome/login email only after the grant succeeds.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| M0 | Preserve production baseline, tag it, branch from synchronized `main`, record decisions | **Complete** |
| M1 | Typed environment/config boundary and canonical student-login target | **Implemented; production values verified** |
| M2 | Bounded Mighty Admin API client and documented member/access operations | **Implemented and focused-tested** |
| M3 | Website Sign In cutover support, Join preservation, safe legacy redirects | **Implemented locally** |
| M4 | Stripe event → durable Mighty desired-state projection | **Implemented locally; event ordering and terminal-state guards included** |
| M5 | Durable worker, retries, stable IDs, access reconciliation, welcome ordering | **Implemented locally; production scheduler workflow defined; worker not live-exercised** |
| M6 | Read-only entitled-member bridge for controlled manual migration | **Implemented locally** |
| M7 | Focused regression tests and validation matrix | **Local focused matrix green; provider/live checks remain cutover gates** |
| M8 | Staging configuration and controlled provider/API verification | **Skipped for this implementation lane; staging remains unchanged** |
| M9 | Production cutover readiness, rollback, and go/no-go | **Owner, administrator, and Phase D ordinary-member canaries passed; cutover not started / not authorized** |

## Approved execution sequence

1. Keep existing Stripe Products, Prices, subscriptions, Checkout, webhooks,
   support, sponsored membership, and operator/admin paths unchanged.
2. Configure the existing Mighty Network and non-paid JPV access Plan outside
   Git. Record only redacted presence/ownership evidence.
3. Run the read-only entitled roster bridge and provision existing members
   under an operator-owned procedure by granting Plan `2000039` to each
   Stripe-ALLOWED member. Before enabling automatic revocation, run the
   read-only manual-access audit and classify other Plans, exceptional Space
   grants, and staff/admin access separately; ordinary legacy direct Network
   membership does not require a separate normalization transition.
4. Validate the worker against a non-production Mighty Network or an approved
   controlled test account when one is available. Confirm create/reuse, grant,
   restore, immediate revoke, retry, and welcome ordering.
   For the real JPV Network, the bounded command is
   `pnpm mighty:production-acceptance`; it requires
   `MIGHTY_PROVIDER_ENV=production`, `MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS=true`,
   and one disposable `MIGHTY_PRODUCTION_TEST_EMAIL`.
   Run `pnpm mighty:config-check` after any configuration change; it reports
   shape/presence only and never replaces provider Plan verification.
5. Configure a scheduled worker call to
   `POST /api/admin/process-mighty-access-sync` with the dedicated worker
   secret. The Stripe webhook itself must never call Mighty synchronously.
6. Complete the focused validation matrix, production configuration review,
   support/admin regression, rollback rehearsal, and go/no-go review. A
   separate staging deployment is not required for this feature-branch lane.
7. Only after a separate authorization may the controlled cutover be deployed.

## Worker execution and scheduling

The worker is an authenticated `POST /api/admin/process-mighty-access-sync`
route. The production scheduler workflow is
`.github/workflows/mighty-access-sync.yml`; it runs every five minutes,
targets only `https://jpvbootcamp.com`, uses the GitHub environment
`production-mighty-sync`, and reads only the
`MIGHTY_ACCESS_SYNC_WORKER_SECRET` environment secret. It is inert until the
feature branch is merged, the worker secret is configured, and the GitHub
environment variable `MIGHTY_ACCESS_SYNC_ENABLED` is explicitly set to the
exact value `true`. The GitHub Actions environment/enablement gate is not
currently configured, so scheduled processing is inert. Manual dispatch
additionally requires selecting
`run_production_sync=yes`; the default is `no`.

The fixed staging scheduler is
`.github/workflows/staging-mighty-access-sync.yml`, which runs every five
minutes, targets only `https://staging.jpvbootcamp.com`, uses the GitHub
environment `staging-mighty-sync`, and reads only the
`MIGHTY_ACCESS_SYNC_WORKER_SECRET` environment secret. It has a non-overlapping
concurrency group and a five-minute timeout. A manual workflow dispatch is
available for controlled staging verification.

Each run claims up to 100 due rows with a five-minute lease. Successful rows
record provider IDs, success, and reconciliation timestamps. Failures record a
safe error code, increment the attempt count, clear the lease, and retry with
exponential backoff capped at one hour. Reconciliation always reuses the stored
Mighty member ID when present, discovers existing Plan purchases before granting,
and treats an absent purchase on revoke as idempotent. The staging scheduler is
retained as-is for the existing staging lane; it is not a prerequisite for the
production feature-branch cutover.

## Focused validation matrix

- Sign In points at the canonical Mighty URL.
- Join still reaches the current pricing section.
- Monthly checkout remains the existing Stripe Checkout route.
- Annual checkout remains the existing Stripe Checkout route.
- Support flow remains available.
- Sponsored/pay-it-forward flow remains available.
- Confirmed new paid subscription creates one `ALLOWED` desired grant.
- Duplicate/replayed Stripe delivery does not create a duplicate access grant.
- Existing Mighty member is reused by normalized email.
- Missing Mighty member is created without a Mighty invitation or welcome email.
- Welcome/login email is attempted only after the access grant succeeds.
- `invoice.payment_failed` records immediate `DENIED` state.
- Revoke is immediate and idempotent when the purchase is already absent.
- Later `invoice.paid` records `ALLOWED` and restores access.
- `cancel_at_period_end` does not enqueue premature removal.
- Actual subscription end enqueues removal.
- Mighty outage leaves the Stripe webhook durable state intact and retryable.
- Failed provider reconciliation records attempt/error/next retry state.
- No native Mighty billing or new Stripe Product/Price is created.
- No custom Mighty course/community implementation is introduced in this
  migration branch.

## Manual bridge procedure

1. Verify the intended operator-owned environment and read-only database boundary.
2. Run `pnpm mighty:bridge-roster` and record the aggregate expected-member count without exporting data.
3. Have a second authorized reviewer compare the count and the active-subscription/payment-state criteria.
4. If a transfer roster is required, run the command with `--format=csv` only
   to a secure location outside the repository and shared logs.
5. An authorized operator adds existing subscribers to the pre-created Mighty
   Network/access Plan and records only aggregate success/failure evidence.
6. Retry only failed rows after resolving the recorded safe error; do not rerun
   a full export. Match by normalized email and existing Mighty member ID before
   any retry, and stop on an identity conflict.
7. Do not change Stripe subscriptions, Stripe products/prices, or local billing
   state as part of this bridge.

## Existing-member migration procedure — prepared, unexecuted

For each Stripe-entitled existing member, the later Phase D operator run must:

1. Resolve the authoritative Stripe customer/subscription entitlement and
   stop on missing, ambiguous, or conflicting identity/state.
2. Find the existing Mighty identity by normalized email and confirm the
   stable member ID. Never create a duplicate member during migration.
3. Read Network membership, all member Plans, target Plan `2000039`, and
   relevant Space membership before changing access.
4. Grant Plan `2000039` and verify it with a separate member-Plan read.
5. Record the member as `PLAN_CONTROLLED`; do not separately delete legacy
   direct Network membership. Review other Plans and exceptional Space access
   with explicit approval before removing any alternate path. Do not use bans,
   account deletion, “Remove From Everything,” or destructive Space/Network
   actions as routine billing enforcement.
6. Verify the member retains the expected access, record a redacted success
   checkpoint, and continue only when the batch remains within its approval.

The runner must support one-member and small-batch modes, a stable run ID,
stop-on-error, resumable checkpoints, idempotent retries, and aggregate audit
evidence. A retry resumes from the last confirmed member and re-reads provider
state before acting. Other Plans, exceptional Space access, and staff/admin
exceptions remain explicit overlap risks; ordinary legacy direct Network
membership is controlled by the Network-access Plan. This procedure remains
documentation-only until the separate controlled-batch authorization.

## Production cutover checklist

Complete these items only under the separate production deployment and go/no-go
authorization:

1. Configure the production application `clients-jpv-bootcamp-app-tp9xrk` with
   the six required Mighty-related values: exact Admin API base URL
   (`https://api.mn.co/admin/v1`), Network ID, the real existing non-paid JPV
   access Plan ID, Admin API token, canonical student login URL, and the worker
   secret. Keep values out of Git, logs, and documentation.
2. Configure the same worker secret in the GitHub environment
   `production-mighty-sync` used by
   `.github/workflows/mighty-access-sync.yml`.
3. Leave `MIGHTY_ACCESS_SYNC_ENABLED` unset until the cutover is authorized;
   the single scheduler-enabling action is setting that production environment
   variable to the exact value `true`.
4. Apply the committed Prisma migrations through the normal controlled
   production deployment path; do not run ad-hoc destructive SQL.
5. Deploy the reviewed feature branch and verify `/api/health`, webhook
   delivery, queue creation, authenticated worker processing, retry behavior,
   and the exact Sign In/Join behavior.
6. Run the read-only roster bridge, reconcile aggregate counts, and manually
   provision existing paid members before relying on automatic new-member
   provisioning.
7. Monitor Stripe delivery failures, queue failures, Mighty API errors, and
   access-denial/grant aggregates. Record the go/no-go decision and operator.

## Rollback procedure

If the cutover is unhealthy, disable the production scheduler workflow first,
then roll the application back to `pre-mighty-migration-2026-09-09` through the
normal deployment controls. Stripe remains the billing authority and existing
Stripe subscriptions are not changed. Keep the legacy portal path available
for support and recovery. Do not automatically mutate Mighty memberships or
delete queue history during rollback; review any provider access corrections
as a separate, explicitly authorized operator action.

## Missing before controlled cutover

- Dedicated Admin API token owner, rotation policy, and target environment.
- GitHub `production-mighty-sync` environment and scheduled-execution secret/
  owner, followed by explicit `MIGHTY_ACCESS_SYNC_ENABLED=true` enablement.
- Fresh owner authorization naming the exact next-batch identity
  `Missaquadri@gmail.com` / Mighty `41567828`, with approval for one Plan grant
  and independent verification. No such execution authorization is recorded
  in Phase E0.
- The current live identity reconciliation is `ALLOWED: 17`, `DENIED: 0`,
  `AMBIGUOUS: 0`, `UNMATCHED: 0`; the eight exact-Mighty misses and the one
  extra-Space identity remain outside the proposed batch.
- Secure manual roster execution and aggregate reconciliation sign-off before
  any further member migration.
- Production verification for billing, support, sponsored membership,
  operator/admin, and the cutover/rollback routes.
- Separate production deployment, migration, data, and go/no-go authorization.
