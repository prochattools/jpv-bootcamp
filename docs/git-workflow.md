# Git + Dokploy Workflow Guide

## Rules
- Never push directly to `main`.
- Always create a feature branch for new work.
- Dokploy Preview Deployments are enabled: each branch auto-deploys to its own preview domain.
- Merge to `main` only after testing preview.

## Dokploy Notes
- For JPV Bootcamp, the live deploy path is `main` push -> GitHub Actions -> GHCR image push -> Dokploy API trigger.
- Dokploy deployment history for this app can lag or show stale entries; trust `application.readLogs` and the live site as the source of truth when there is a mismatch.
- The JPV Bootcamp Dokploy app must keep `buildType=dockerfile` with `dockerfile=Dockerfile` so Dokploy recognizes the repo root Dockerfile.

## Steps
1. git checkout main && git pull origin main
2. git checkout -b feature/branch-name
3. git add . && git commit -m "Message"
4. git push origin feature/branch-name
5. Test preview deployment in Dokploy
6. Merge into main → deploys to production
7. git branch -d feature/branch-name && git push origin --delete feature/branch-name

## Automation Tasks

### Start Feature Branch
```bash
# Create and push a new feature branch
git checkout main
git pull origin main
git checkout -b feature/${FEATURE_NAME}
git push origin feature/${FEATURE_NAME}
```

### Merge to Main
```bash
# Merge a feature branch into main and push
git checkout main
git pull origin main
git merge feature/${FEATURE_NAME}
git push origin main
```
