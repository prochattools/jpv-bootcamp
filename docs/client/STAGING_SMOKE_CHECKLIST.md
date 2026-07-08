# Staging Smoke Checklist

Manual smoke checklist for `feature/course-branding-and-preview`, the staging / production-staged deployment branch.

## Run metadata

- Branch:
- Deployed commit:
- Smoke operator:
- Date:
- Environment URL:
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
- Operator handoff summary: `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- Evidence review checklist: `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`
- Evidence template: `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md`

## Pass / fail fields

- Result: `pass` / `fail` / `blocked`
- Notes:
- Escalation owner:
- Rollback decision:

## Manual smoke steps

1. Verify deployed commit matches the latest approved branch commit.
   Result:
   Notes:

2. Verify the public landing page loads without error and reflects Free/Pro-only language.
   Result:
   Notes:

3. Verify Pro monthly checkout starts from `/api/stripe/checkout?plan=pro&billing=monthly`.
   Result:
   Notes:

4. Verify Pro annual checkout starts from `/api/stripe/checkout?plan=pro&billing=annual`.
   Result:
   Notes:

5. Verify invalid and legacy checkout plans fail safely, including rejected `vip`, `exhibitor`, and legacy table-plan values.
   Result:
   Notes:

6. Verify billing portal login and return flow behaves correctly for a controlled member.
   Result:
   Notes:

7. Verify the support/pay-it-forward application flow submits and lands in the expected review/admin path.
   Result:
   Notes:

8. Verify sponsor/pay-it-forward checkout flow, if enabled in staging, behaves as a controlled non-membership flow.
   Result:
   Notes:

9. Verify the sponsored claim flow grants controlled Free access only.
   Result:
   Notes:

10. Verify representative course access boundaries for Free versus Pro members.
    Result:
    Notes:

11. Verify admin sponsored approval and rejection flows complete without old integration redirects.
    Result:
    Notes:

12. Verify no WordPress, Fluent, or old portal path is reachable as an active route.
    Result:
    Notes:

13. Verify deploy did not auto-apply migrations.
    Result:
    Notes:

14. Verify provider email live delivery separately from this smoke run.
    Result:
    Notes:

## Rollback and escalation

- Rollback image or commit:
- Blocking issue summary:
- Escalate to:
- Follow-up ticket or doc:

## Evidence capture

Use `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` to record the final operator evidence after the checklist is run.
