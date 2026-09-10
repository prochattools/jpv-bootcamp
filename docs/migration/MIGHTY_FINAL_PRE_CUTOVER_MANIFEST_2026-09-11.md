# Mighty final pre-cutover manifest and read-only rehearsal — 2026-09-11

## Gate state

`INTEGRATION LOGIC: READY`
`REAL MEMBER MIGRATION: NOT STARTED`
`CURRENT GATE: FINAL ROLE / IDENTITY / OVERLAP MANIFEST + READ-ONLY CUTOVER REHEARSAL`
`PRODUCTION SCHEDULER: DISABLED`
`NEXT AFTER PASS: OWNER GO / NO-GO DECISION FOR A SEPARATELY APPROVED CUTOVER BATCH`

This document is a deterministic, read-only production rehearsal. It does not
authorize, perform, or imply a migration. No real member was created, invited,
granted, revoked, restored, or otherwise modified. Stripe was not mutated. The
staging application was not used.

The only live identities previously authorized for bounded provider acceptance
remain `westhoek@hotmail.com`, `steve@yeshua.academy`, and
`info@prochat.tools`. They are represented here as controls/exclusions only;
this rehearsal did not mutate them.

## Evidence snapshot

The application-shaped rehearsal command is:

```text
pnpm mighty:cutover-rehearsal
```

Its production invocation was supplied the current production application
environment in memory and enforced `STRIPE_ENV=live` plus
`MIGHTY_PROVIDER_ENV=production`. It used live Stripe subscription reads,
Mighty member/member-plan/Space/purchase reads, and exact email lookup. The
command never imports or calls Mighty create/grant/revoke methods or Stripe
mutation methods.

| Evidence | Result |
| --- | --- |
| Active Stripe subscriptions | 17 |
| Stripe identity reconciliation | 17 allowed; 0 denied; 0 ambiguous; 0 unmatched |
| Mighty members inventoried | 15 |
| Mighty purchases inventoried | 0 |
| Access Plan | `2000039` — `JPV Member Access`, hidden, non-paid |
| Manifest rows | 17 |
| Mutation performed | `false` |
| Scheduler | Disabled; no `MIGHTY_ACCESS_SYNC_ENABLED` repository variable |

## Deterministic per-record manifest

`target` is the state of Plan `2000039`. `std` is standard JPV Spaces as
`count/complete`. `other` is the count of other Plans; `purch` is
`target/other` purchase count. `rollback` is the required future recovery
reference, not an action taken by this rehearsal.

| Identity | Stripe | Mighty match / ID | Role class | target | other | purch | std | extra Spaces | Duplicate risk | Proposed action | Review reason | Rollback reference |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| `adaumoudit@gmail.com` | ALLOWED (`sub_1UAxsf…`) | EXACT / `41566725` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | — | NONE | `IDENTITY_REVIEW_REQUIRED` | provider role absent | preserve/create same normalized email; never delete member |
| `amechiclarangozi2022@gmail.com` | ALLOWED (`sub_1U2v5Z…`) | EXACT / `41567964` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | — | NONE | `IDENTITY_REVIEW_REQUIRED` | provider role absent | preserve/create same normalized email; never delete member |
| `anita13steve@gmail.com` | ALLOWED (`sub_1TPTy6…`) | NO_EXACT / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | NONE | `CREATE_NEW_AT_CUTOVER` | no exact account; creation future-only | create/reuse same normalized email; never delete member |
| `happyalamss@gmail.com` | ALLOWED (`sub_1UBZmB…`) | EXACT / `41566259` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | — | NONE | `IDENTITY_REVIEW_REQUIRED` | provider role absent | preserve/create same normalized email; never delete member |
| `info@yeshua.academy` | ALLOWED (`sub_1UAaup…`) | NO_EXACT / — | PRIVILEGED | absent | 0 | 0/0 | 0/false | — | NONE | `PRIVILEGED_EXCLUDED` | owner control identity | owner-controlled; no automated migration |
| `Katherinecd7@yahoo.com` | ALLOWED (`sub_1U69vu…`) | EXACT / `41585608` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | — | NONE | `IDENTITY_REVIEW_REQUIRED` | provider role absent | preserve/create same normalized email; never delete member |
| `kem.okupa@gmail.com` | ALLOWED (`sub_1UEA3t…`) | NO_EXACT / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | NONE | `CREATE_NEW_AT_CUTOVER` | no exact account; creation future-only | create/reuse same normalized email; never delete member |
| `marek_bed@yahoo.com` | ALLOWED (`sub_1TPo5V…`) | NO_EXACT / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | NONE | `CREATE_NEW_AT_CUTOVER` | no exact account; creation future-only | create/reuse same normalized email; never delete member |
| `missaquadri@gmail.com` | ALLOWED (`sub_1UBIsR…`) | EXACT / `41567828` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | — | NONE | `IDENTITY_REVIEW_REQUIRED` | provider role absent | preserve/create same normalized email; never delete member |
| `nsgonza2@gmail.com` | ALLOWED (`sub_1TP1Ev…`) | NO_EXACT / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | NONE | `CREATE_NEW_AT_CUTOVER` | no exact account; creation future-only | create/reuse same normalized email; never delete member |
| `prince.okoroego@gmail.com` | ALLOWED (`sub_1THihD…`) | NO_EXACT / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | NONE | `CREATE_NEW_AT_CUTOVER` | no exact account; creation future-only | create/reuse same normalized email; never delete member |
| `ronyaa@live.co.uk` | ALLOWED (`sub_1TPj4p…`) | EXACT / `41568214` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | — | NONE | `IDENTITY_REVIEW_REQUIRED` | provider role absent | preserve/create same normalized email; never delete member |
| `samuel.roy.edward.hill@gmail.com` | ALLOWED (`sub_1UBHx2…`) | AMBIGUOUS / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | REVIEW | `IDENTITY_REVIEW_REQUIRED` | blank-email Mighty `41583824` matches profile name | operator must resolve identity before create/reuse |
| `steve@yeshua.academy` | ALLOWED (`sub_1UAWSO…`) | EXACT / `41580680` | PRIVILEGED | present | 0 | 0/0 | 5/true | — | NONE | `PRIVILEGED_EXCLUDED` | administrator control identity | remove Plan only if separately authorized; preserve member |
| `tosinotubanjo@gmail.com` | ALLOWED (`sub_1TPl9C…`) | EXACT / `41582168` | PRIVILEGE_UNKNOWN | absent | 0 | 0/0 | 5/true | `FIRST FOUNDATION` | NONE | `OVERLAP_REVIEW_REQUIRED` | non-standard Space overlap | resolve Space/access overlap before any Plan action |
| `vimbaimt@gmail.com` | ALLOWED (`sub_1TPjAz…`) | NO_EXACT / — | NOT_YET_PROVISIONED | absent | 0 | 0/0 | 0/false | — | NONE | `CREATE_NEW_AT_CUTOVER` | no exact account; creation future-only | create/reuse same normalized email; never delete member |
| `westhoek@hotmail.com` | ALLOWED (`sub_1TwNFM…`) | EXACT / `41580317` | ORDINARY (operator-approved control) | present | 0 | 0/0 | 5/true | — | NONE | `ALREADY_PLAN_CONTROLLED` | restored canary control identity | Plan-only rollback preserves member `41580317` |

The application output and this table agree on all 17 normalized identities and
all action classes. Summary: `MIGRATE_EXISTING=0`,
`ALREADY_PLAN_CONTROLLED=1`, `CREATE_NEW_AT_CUTOVER=6`,
`PRIVILEGED_EXCLUDED=2`, `OVERLAP_REVIEW_REQUIRED=1`,
`IDENTITY_REVIEW_REQUIRED=7`, `BLOCKED=0`.

No identity is currently safe for an automated grant batch: the six exact
ordinary-looking members have no provider role, and the policy fails closed
instead of inferring ordinary status from `member_type` or standard Spaces.
The six no-exact identities are future creation candidates only. Samuel is an
identity review because a blank-email provider member has a matching profile
name. Tosin has an extra Space and must not be normalized automatically.

## Existing manual-access normalization

The authoritative future path is:

```text
Stripe entitlement → JPV Member Access Plan 2000039 → Mighty access
```

Before automated revocation is enabled, the owner must approve a bounded
normalization batch from a fresh manifest. For each row, the operator must:

1. Re-read the Stripe entitlement and exact normalized email.
2. Re-read the Mighty member, role, all Plans, all purchases, and all Spaces.
3. Stop on missing/ambiguous identity, unknown role, privileged role, other
   Plan/purchase, extra Space, duplicate risk, or provider uncertainty.
4. Reuse an exact existing member ID where safe; create only a no-exact,
   explicitly approved ordinary identity, with welcome/invitation disabled.
5. Grant only Plan `2000039`, verify exactly one target Plan and effective
   access, then checkpoint the member ID and provider result.
6. Never remove a direct Space or alternate Plan as “normalization.” Those
   are separate access sources and require an explicit owner decision.
7. For denial, remove only Plan `2000039`, verify effective access is removed,
   and retain the member identity. A Plan removal cannot prove paid access is
   gone if another Plan, purchase, direct Space, or privileged membership still
   grants access; that overlap is a hard stop.

Current overlap evidence is zero other Plans, zero purchases, and one extra
Space (`FIRST FOUNDATION`) for Tosin. The inventory also contains direct/no-Plan
members outside the Stripe-entitled set. They are not modified here. This is
the exact overlapping-access risk: removing Plan `2000039` alone is
authoritative only after all other access sources for that member have been
reviewed.

## Future runner contract

`src/lib/mighty/cutoverRunner.ts` provides a bounded, dependency-injected
runner for a future approved batch. It is not enabled by the scheduler and was
not run against production. Its contract is:

- one bounded batch at a time, exact manifest rows only;
- checkpoint states `PENDING`, `IN_PROGRESS`, `VERIFIED`,
  `REVIEW_REQUIRED`, `FAILED_RESTORED`, and `COMPLETE`;
- stop on the first provider error; do not continue to later rows;
- on a failed existing-member grant, attempt Plan-only rollback and checkpoint
  `FAILED_RESTORED`; if rollback is uncertain, stop at `REVIEW_REQUIRED`;
- resume from checkpoint and skip `COMPLETE`/`VERIFIED` rows;
- repeat grants are idempotent and independently verified;
- identity, privileged, overlap, and provider-uncertain rows are skipped;
- no direct Network/Space normalization, no Stripe mutation, and no automatic
  deletion or recreation of a member.

Synthetic tests cover one-member execution, bounded batches, checkpoint/resume,
stop-on-error, rollback, idempotent rerun, provider uncertainty, and review
skips. The new-subscriber path is synthetic only; no production Mighty create
was performed.

## Release boundary

This work remains on `feature/mighty-stripe-migration`. It is not merged,
deployed, or enabled in the production scheduler. The only unrelated dirty
worktree file is `newrelic_agent.log`; it must remain untouched and untracked
by this change.

The next gate is an owner go/no-go decision naming an exact future batch and
explicitly approving any role overrides or identity resolutions. Until then,
the correct state is read-only rehearsal complete, real member migration not
started, scheduler disabled.
