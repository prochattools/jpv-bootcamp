# Git + Dokploy Workflow Guide

## Rules
- Never push directly to `main`.
- Always create a feature branch for new work.
- Dokploy Preview Deployments are enabled: each branch auto-deploys to its own preview domain.
- For the Payload-only Free/Pro staging work, `feature/course-branding-and-preview` is the staging / production-staged deployment target.
- Do not switch to, merge into, or deploy from `main` during this staging branch workflow.
- Do not apply Prisma or Payload migrations from branch push/deploy. Migration execution requires a separate approved database migration path.

## Dokploy Notes
- For the current JPV Bootcamp staging path, deploy `feature/course-branding-and-preview` only. `main` is outside the staging branch workflow.
- Dokploy deployment history for this app can lag or show stale entries; trust `application.readLogs` and the live site as the source of truth when there is a mismatch.
- The JPV Bootcamp Dokploy app must keep `buildType=dockerfile` with `dockerfile=Dockerfile` so Dokploy recognizes the repo root Dockerfile.

## Steps
1. Confirm the branch is `feature/course-branding-and-preview`.
2. Commit reviewed staging changes on that branch.
3. Push `feature/course-branding-and-preview` to origin.
4. Test the staging / production-staged deployment target.
5. Keep migration execution separate until explicitly approved for the target environment.

## Automation Tasks

### Verify Staging Branch
```bash
git branch --show-current
git status -sb
```

### Push Staging Branch
```bash
git push origin feature/course-branding-and-preview
```
