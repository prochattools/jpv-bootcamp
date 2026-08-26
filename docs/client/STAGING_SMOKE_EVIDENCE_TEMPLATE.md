# Staging Smoke Evidence Template

Operator-facing evidence template for staging smoke on `feature/course-branding-and-preview`.

**Note:** This is a template. Operator fills this evidence manually during actual staging smoke execution. Draft evidence files can be generated from this template using `npx tsx scripts/create_staging_evidence_artifacts.ts` (local-only, no migrations applied). Use `npx tsx scripts/validate_staging_evidence_artifacts.ts` to validate completed evidence for safety and secret-leakage.

## Header

- Branch: `feature/course-branding-and-preview`
- Deployed commit:
- Operator:
- Date/time:
- Environment:
- PR / review URL: `https://github.com/prochattools/jpv-bootcamp/pull/2`
- Migrations applied: `No`
- Operator handoff summary: `docs/client/OPERATOR_HANDOFF_SUMMARY.md`
- Evidence review checklist: `docs/client/EVIDENCE_REVIEW_CHECKLIST.md`

## Hard safety confirmation

- [ ] Branch is `feature/course-branding-and-preview`
- [ ] main was not touched
- [ ] No migrations were applied
- [ ] No DB-mutating commands were run
- [ ] No secrets were pasted into this evidence doc
- [ ] Deployment did not auto-apply migrations

No migrations were applied.

## Smoke checks

Record `pass` / `fail` / `evidence` for each check.

1. Public landing page loads
   - Result:
   - Evidence:
   - Notes:

2. Pro monthly checkout starts
   - Result:
   - Evidence:
   - Notes:

3. Pro annual checkout starts
   - Result:
   - Evidence:
   - Notes:

4. Invalid and legacy checkout plans fail safely
   - Result:
   - Evidence:
   - Notes:

5. Billing portal return flow works
   - Result:
   - Evidence:
   - Notes:

6. Support/pay-it-forward application flow works
   - Result:
   - Evidence:
   - Notes:

7. Sponsor/pay-it-forward checkout flow, if enabled, works
   - Result:
   - Evidence:
   - Notes:

8. Sponsored claim flow grants controlled Free access
   - Result:
   - Evidence:
   - Notes:

9. Free vs Pro course access behaves correctly
   - Result:
   - Evidence:
   - Notes:

10. Admin sponsored approval/rejection flows work
    - Result:
    - Evidence:
    - Notes:

11. Old WordPress, Fluent, and old portal paths are not reachable
    - Result:
    - Evidence:
    - Notes:

12. Provider email delivery verified separately
    - Result:
    - Evidence:
    - Notes:

## Failure handling

- Blocker found:
- Rollback or escalation owner:
- Screenshot or log references:
- Follow-up task:

## Final signoff

- Staging smoke pass/fail:
- Operator signoff:
- Reviewer signoff:
