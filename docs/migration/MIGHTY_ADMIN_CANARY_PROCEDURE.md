# Mighty Administrator Canary Procedure

## Purpose

This is the Phase C operator procedure for one explicitly authorized existing
administrator. It prepares the next rollout stage without changing any
administrator or member now. Plan `2000039` is the access-only JPV Plan;
Stripe remains the billing authority.

## Preconditions

1. Phase B owner acceptance is complete and the owner canary remains restored.
2. The owner supplies exactly one administrator identity and explicitly
   authorizes that identity for this canary. Never infer an identity from
   repository, database, or Mighty roster data.
3. Production automation remains disabled.
4. The operator records a run ID, target identity, starting access state, and
   the exact commit/configuration used. Do not record API tokens or other
   secrets.

## Controlled procedure

1. Normalize the supplied email and find the existing Mighty member. If no
   member exists, stop; this canary is for an existing administrator and must
   not create an account.
2. Read and record the member's current Network, Space, Plan, and target-Plan
   access state. A target-Plan grant must not be assumed from a member record.
3. Grant Plan `2000039` through the Admin API and verify the target Plan with
   an independent member-Plan read.
4. If revoke testing is explicitly requested, pause at a second confirmation
   boundary naming the exact administrator and Plan. Never infer permission to
   revoke from the original grant authorization.
5. Revoke only Plan `2000039`, verify that target-Plan access is absent, and
   immediately restore it. Verify the restored Plan access independently.
6. On any error, stop the run, preserve the current access state, and record a
   redacted failure result. Do not continue to another identity or batch.
7. Leave the administrator in the restored, expected state and record only
   aggregate/safe evidence.

The grant and restore operations must be idempotent. Repeating the grant must
not create duplicate access, and repeating a revoke of already-absent target
access must be safe. The process must use the stable Mighty member ID after
the initial identity lookup; email is discovery data, not the permanent
identity key.

## Explicit boundaries

- This procedure does not create or modify a second test identity.
- It does not touch a real student, the existing member population, Stripe,
  other Plans, Network membership, or Space membership.
- It does not use Mighty billing, invitations, bans, “Remove From Everything,”
  or account deletion.
- It does not enable the production scheduler or deploy the feature branch.

## Readiness

The procedure is prepared and remains unexecuted. Phase C may begin only when
the owner supplies an exact administrator email and a separate explicit
authorization for that identity. The current goal intentionally stops before
that phase.
