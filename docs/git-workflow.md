# Git + Dokploy Workflow Guide

> Current authority: [Repository Clean Baseline — 2026-09-02](release/REPOSITORY_CLEAN_BASELINE_2026-09-02.md). The older feature-branch instructions previously in this file are superseded.

## Rules
- Never push directly to `main`.
- Always create a feature branch for new work.
- Staging is the guarded `https://staging.jpvbootcamp.com` lane and accepts only `feature/*`, `fix/*`, or `release/*` source refs through the existing workflow.
- Production is the guarded `main` lane and is separate from staging and legacy.
- Do not merge, deploy, or apply migrations while the baseline is marked `BLOCKED`.
- Do not apply Prisma or Payload migrations from branch push/deploy. Migration execution requires a separate approved database migration path.

## Dokploy Notes
- Dokploy deployment history can lag or show stale entries; use the guarded workflow evidence and live health endpoint together.
- The JPV Bootcamp Dokploy app must keep its reviewed Docker build configuration; never target the legacy application from the current production/staging lanes.

## Steps
1. Start from `origin/main` for new feature or hardening work.
2. Use a reviewed `feature/*`, `fix/*`, or `release/*` branch for staging-only validation.
3. Run `pnpm test:release` and the relevant guarded read-only gates.
4. Obtain required review and environment approval before any external mutation.
5. Keep migration execution separate from image publication and deployment.

## Automation Tasks

### Verify Staging Branch
```bash
git branch --show-current
git status -sb
```

### Push Reviewed Branch
```bash
git push origin <reviewed-branch>
```
