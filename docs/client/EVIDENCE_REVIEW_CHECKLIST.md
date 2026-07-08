# Evidence Review Checklist

Use this checklist after an operator fills the evidence templates in `docs/client/evidence/`.

Run `pnpm toolchain:check` before manual staging smoke or evidence capture if your shell pnpm version is not already pinned to `pnpm@10.33.0`.
Run `pnpm staging:static-preflight` before manual staging smoke or evidence capture. It performs local-only checks, does not apply migrations, does not run live network checks, and does not prove operator approval.
Generated evidence files can be created with `pnpm evidence:create` or `tsx scripts/create_staging_evidence_artifacts.ts` (optional, local-only, no migrations applied, no DB access, no network access).
Completed evidence can be validated with `pnpm evidence:validate` or `tsx scripts/validate_staging_evidence_artifacts.ts` (local-only, checks for secrets and consistency).
Generated drafts do not prove checks passed.

## Review checks

- [ ] Branch is `feature/course-branding-and-preview`
- [ ] Deployed commit is recorded
- [ ] Migrations applied remains `No` unless a separately approved migration task has occurred
- [ ] `pnpm toolchain:check` was run before `pnpm staging:static-preflight` when needed
- [ ] Staging smoke evidence is complete
- [ ] Provider/email evidence is complete
- [ ] No secrets were pasted
- [ ] No screenshots or log references expose API keys or tokens
- [ ] Pass/fail status is recorded for each smoke area
- [ ] Blockers are listed with owners
- [ ] Provider/email mode is recorded
- [ ] `pnpm staging:static-preflight` was run before manual staging smoke or evidence capture
- [ ] Old WordPress, Fluent, and portal-path checks were recorded
- [ ] Free vs Pro access evidence was recorded
- [ ] Reviewer signoff exists
- [ ] Unfilled draft evidence files are not being committed
- [ ] No secrets were pasted into evidence files

## Hard stop

If migrations are marked applied but no separate approved migration record exists, stop and escalate.
