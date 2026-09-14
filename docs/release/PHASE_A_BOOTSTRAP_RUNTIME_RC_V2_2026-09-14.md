# Phase A authoritative bootstrap runtime RC v2

## Review status

`READY FOR OWNER REVIEW`

This release candidate is based directly on production revision
`b1e105d3ac855f20a983fb70bcefffb2490c864f` after the
`20260914140000_add_mighty_bootstrap_provenance` migration was applied and
verified clean. It is on branch
`codex/mighty-phase-a-bootstrap-runtime-rc-v2` and is not deployed.

## Bounded runtime scope

- Exact bootstrap identity: `westhoek@hotmail.com` only.
- Exact local Stripe customer/subscription identity is required; no Stripe
  enumeration or search is used.
- Stripe remains the sole entitlement authority and the existing
  `deriveMightyDesiredAccess` decision is reused.
- Bootstrap queues `stateSource=operator_bootstrap` and `stateObservedAt`.
- Bootstrap does not fabricate Stripe event fields, call Mighty, or send email.
- Provider I/O remains in the authenticated worker path.
- Newer genuine Stripe webhooks supersede bootstrap state; older events cannot
  regress it; stale worker finalization is guarded by row provenance/status.
- Repeated bootstrap is idempotent and produces one queue row.

The applied provenance migration is preserved. No new migration is introduced,
and the existing verifier/runtime migration assumptions were not replaced.

## Validation

Synthetic/local validation passed:

- bootstrap runtime/route/queue tests: 28 passing;
- migration contract: 28/28;
- cutover runner: 10/10;
- migration readiness: 9/9;
- synthetic hardening: 4/4;
- inert deployment safety: 4/4;
- access sync: 15/15;
- event mapping: 4/4;
- TypeScript, Prisma schemas, production build, and diff check;
- release suite: 198/198.

The build used non-production placeholder configuration only. No live Stripe or
Mighty request, deployment, migration, worker execution, scheduler execution,
population inspection, real manifest creation, or user/data change occurred.

## Next gate

Owner review of one exact pushed RC commit. Deployment, live bootstrap, and any
real-member operation require separate explicit authorization.
