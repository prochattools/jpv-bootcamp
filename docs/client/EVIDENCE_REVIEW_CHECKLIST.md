# Evidence Review Checklist

Use this checklist after an operator fills the evidence templates in `docs/client/evidence/`.

For controlled staging evidence, use an approved `feature/*`, `fix/*`, or
`release/*` source ref and the canonical staging origin
`https://staging.jpvbootcamp.com`. Verify the exact deployed commit before
review; this checklist does not authorize deployment, migrations, provider
mutation, or production action.

Run `pnpm toolchain:check` before manual staging smoke or evidence capture if your shell pnpm version is not already pinned to `pnpm@10.33.0`.
Run `pnpm staging:static-preflight` before manual staging smoke or evidence capture. It performs local-only checks, includes a committed-evidence guard, does not apply migrations, does not run live network checks, and does not prove operator approval.
Generated evidence files can be created with `pnpm evidence:create` or `tsx scripts/create_staging_evidence_artifacts.ts` (optional, local-only, no migrations applied, no DB access, no network access). Draft evidence `.md` files under `docs/client/evidence/` are local operator artifacts and must not be committed unless explicitly approved. `pnpm evidence:create` is separate from static preflight.
Completed evidence can be validated with `pnpm evidence:validate` or `tsx scripts/validate_staging_evidence_artifacts.ts` (local-only, checks for secrets and consistency).
Generated drafts do not prove checks passed.

## Review checks

- [ ] Source ref matches the approved `feature/*`, `fix/*`, or `release/*` policy
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
- [ ] Draft evidence `.md` files were not committed unless explicitly approved
- [ ] Old WordPress, Fluent, and portal-path checks were recorded
- [ ] Free vs Pro access evidence was recorded
- [ ] Reviewer signoff exists
- [ ] Unfilled draft evidence files are not being committed
- [ ] No secrets were pasted into evidence files

## Hard stop

If migrations are marked applied but no separate approved migration record exists, stop and escalate.
