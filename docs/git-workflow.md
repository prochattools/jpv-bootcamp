# Git + Dokploy Workflow Guide

## Rules
- Never push directly to `main`.
- Always create a feature branch for new work.
- Historical Dokploy preview deployments may exist per branch; the current guarded staging path is dispatch-only and targets the canonical staging origin.
- For the guarded staging workflow, approved source refs match `feature/*`, `fix/*`, or `release/*`; the canonical target is `https://staging.jpvbootcamp.com`.
- `main` remains the production release authority. The current hygiene review branch is repository evidence only until a separately authorized exact-SHA deployment.
- Do not apply Prisma or Payload migrations from branch push/deploy. Migration execution requires a separate approved database migration path.

## Dokploy Notes
- For the current JPV Bootcamp staging path, use the guarded `deploy-preview` workflow with an approved source ref and exact SHA. Ordinary pushes remain validation-only.
- Dokploy deployment history for this app can lag or show stale entries; trust `application.readLogs` and the live site as the source of truth when there is a mismatch.
- The JPV Bootcamp Dokploy app must keep `buildType=dockerfile` with `dockerfile=Dockerfile` so Dokploy recognizes the repo root Dockerfile.

## Steps
1. Confirm the source ref matches the approved staging pattern.
2. Commit reviewed changes on that branch.
3. Push the branch to origin for validation-only checks.
4. Use the separate guarded exact-SHA dispatch when staging deployment is explicitly authorized.
5. Keep migration execution separate until explicitly approved for the target environment.

## Automation Tasks

### Verify Staging Branch
```bash
git branch --show-current
git status -sb
```

### Push Staging Branch
```bash
# Example only; use the approved source ref for the reviewed change.
git push origin feature/my-reviewed-change
```
