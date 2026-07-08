# Evidence Review Checklist

Use this checklist after an operator fills the evidence templates in `docs/client/evidence/`.

Generated evidence files can be created with `npx tsx scripts/create_staging_evidence_artifacts.ts` (local-only, no migrations applied).
Completed evidence can be validated with `npx tsx scripts/validate_staging_evidence_artifacts.ts` (local-only, checks for secrets and consistency).

## Review checks

- [ ] Branch is `feature/course-branding-and-preview`
- [ ] Deployed commit is recorded
- [ ] Migrations applied remains `No` unless a separately approved migration task has occurred
- [ ] Staging smoke evidence is complete
- [ ] Provider/email evidence is complete
- [ ] No secrets were pasted
- [ ] No screenshots or log references expose API keys or tokens
- [ ] Pass/fail status is recorded for each smoke area
- [ ] Blockers are listed with owners
- [ ] Provider/email mode is recorded
- [ ] Old WordPress, Fluent, and portal-path checks were recorded
- [ ] Free vs Pro access evidence was recorded
- [ ] Reviewer signoff exists

## Hard stop

If migrations are marked applied but no separate approved migration record exists, stop and escalate.
