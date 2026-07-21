# Provider Verification Runbook

Repository-owned verification contract for controlled staging checks. This runbook documents safe manual operator work. It does not execute provider calls.

## Scope

- Branch: `feature/course-branding-and-preview`
- Staging smoke plan command: `pnpm staging:smoke-plan`
- Migration preflight command: `pnpm staging:migration-preflight`
- Provider simulation command: `pnpm staging:provider-simulation`
- Local simulated smoke command: `pnpm staging:smoke-simulated`
- Existing evidence templates:
  - `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md`
  - `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md`
- Repository-owned release evidence summary:
  - `pnpm release:evidence:dry-run`

## Global rules

- Verify only names and states; never paste live secret values.
- No provider verification authorizes migration execution.
- No provider verification authorizes deployment.
- Use controlled internal test identities only.
- Capture sanitized evidence only.
- Treat queue inspection and dry-run review as separate from live delivery approval.

## Email verification

| Field | Requirement |
| --- | --- |
| Environment | Approved staging environment only |
| Operator | Named operator with email/provider approval |
| Required credentials | Resend-capable environment access and approved queue/admin access |
| Safe test data | Controlled internal recipient only |
| Evidence artifact | `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` |
| Rollback / disable | Re-disable non-webhook sends, stop queue processing, leave persisted requests intact |

Checks:

1. Confirm support recipient configuration exists by variable name only.
2. Confirm queue-only behavior remains the operational path.
3. Confirm there is no direct-send shortcut in the support workflow.
4. Confirm retry state is preserved on failure.
5. Confirm provider errors remain redacted in UI and logs.
6. Confirm any live verification email uses one approved controlled recipient and one approved event scope.

Pass criteria:

- queued email path is the only approved operational send path;
- failures remain retryable and redacted;
- no support request claims email delivery before the queue and provider steps complete.

Fail criteria:

- direct-send path exists;
- redaction fails;
- queue retry behavior is not preserved;
- verification would require unapproved recipient scope.

## Stripe verification

| Field | Requirement |
| --- | --- |
| Environment | Approved staging environment only |
| Operator | Named billing operator |
| Required credentials | Approved Stripe-mode environment access only |
| Safe test data | Controlled member account and approved staging checkout flow |
| Evidence artifact | `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` plus billing notes |
| Rollback / disable | Stop verification, keep checkout unapproved, revert to pending billing state |

Checks:

1. Confirm checkout accepts only `plan=pro`.
2. Confirm supported billing values are `monthly` and `annual` only.
3. Confirm no client-controlled amount, success URL, cancel URL, or return URL is accepted.
4. Confirm billing portal returns to the approved portal billing route.
5. Confirm webhook endpoint ownership remains `/api/webhook/stripe`.
6. Confirm no live charge is executed unless separately approved.

Pass criteria:

- Pro monthly and Pro annual are the only supported public paid starts;
- billing portal and webhook paths remain canonical;
- unsupported plan or cadence values fail safely.

Fail criteria:

- unsupported plan starts;
- unsafe return URLs are accepted;
- webhook or billing-portal ownership drifts.

## Payload and admin verification

| Field | Requirement |
| --- | --- |
| Environment | Approved staging environment only |
| Operator | Approved administrator |
| Required credentials | Payload admin login and controlled member login |
| Safe test data | Controlled administrator and member identities |
| Evidence artifact | `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` |
| Rollback / disable | Stop verification and block release if operator boundaries fail |

Checks:

1. Verify administrator login works only through `/admin`.
2. Verify ordinary members cannot access operator-only review routes.
3. Verify review surfaces load for administrators without exposing public operator routes.
4. Verify member portal and admin sessions remain separate.

Pass criteria:

- operator boundaries hold;
- no public operator access exists;
- admin review surfaces remain authenticated only.

Fail criteria:

- anonymous or member access reaches operator views;
- member and admin sessions cross over.

## Support-intake verification

| Field | Requirement |
| --- | --- |
| Environment | Approved staging environment after approved migration apply |
| Operator | Approved support operator |
| Required credentials | App access plus admin review access |
| Safe test data | Controlled internal support request |
| Evidence artifact | `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` and `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` |
| Rollback / disable | Stop provider verification and hold release if persistence or review state is wrong |

Prerequisite:

- The `support_requests` migration must already be applied through the approved migration path.

Checks:

1. Verify valid intake persists durably.
2. Verify duplicate intake resolves to the same safe success contract.
3. Verify queue state is recorded after persistence.
4. Verify retryable failure preserves the request and records retry state.
5. Verify review state remains explicit.
6. Verify support intake grants no access automatically.

Pass criteria:

- durable persistence succeeds before success is shown;
- dedupe, queue, and review state remain intact;
- no support submission grants Free or Pro access.

Fail criteria:

- success appears without persistence;
- queue state disappears;
- access is granted from support intake.

## Redaction rules

- Never record raw email addresses, provider IDs, tokens, URLs with query secrets, or database identifiers.
- Use masked identities only.
- Record yes/no or pass/fail evidence, not secret payloads.

## Operator sequence

1. Run `pnpm staging:migration-preflight`.
2. Run `pnpm staging:smoke-plan`.
3. Confirm migration approval and whether support-intake verification is in scope for the current window.
4. Confirm Stripe, Payload/admin, and email verification owners.
5. Record evidence in the approved templates.
6. Update the go/no-go checklist only after manual evidence exists.

## Current repository status

Provider verification is documented but unexecuted.

- Provider simulation: PASS 10/10 (repository-local, HEAD `32874a2`)
- Local simulated staging smoke: PASS 5/5 (repository-local)
- Stripe verification: documented; live execution evidence recorded in `docs/release/GO_NO_GO_CHECKLIST.md` and `docs/decisions/CORE_GO_LIVE_DECISION.md`
- Email/Resend verification: documented; live execution evidence recorded in `docs/release/GO_NO_GO_CHECKLIST.md` and `docs/decisions/CORE_GO_LIVE_DECISION.md`
- Bunny CDN verification: documented; live execution evidence recorded in `docs/release/GO_NO_GO_CHECKLIST.md` and `docs/decisions/CORE_GO_LIVE_DECISION.md`
- Payload/admin staging verification: PENDING — requires named operator login with controlled test account
- Support-intake live verification: BLOCKED — REM-09 support migration unapplied (expected; not a regression)
