# Agent Mode Progress — Staging Media Durability

## Goal

Remediate media durability for `preview.jpvbootcamp.com` only, starting from deployed revision `5130191`. Never inspect or modify the deny-listed production application.

## Current evidence

- Repository media configuration supports `local` and `s3` modes.
- `PAYLOAD_MEDIA_REQUIRE_DURABLE=true` currently requires `PAYLOAD_MEDIA_STORAGE_MODE=s3`.
- Required S3 keys are `PAYLOAD_MEDIA_S3_BUCKET`, `PAYLOAD_MEDIA_S3_REGION`, `PAYLOAD_MEDIA_S3_ACCESS_KEY_ID`, and `PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY`; endpoint, prefix, and force-path-style are optional.
- The existing staging runtime has no active media S3 settings and no repository-local Dokploy credentials.
- Staging media currently resolves to `/app/public/media` without a verified persistent mount.
- Repository documentation names staging Dokploy app `I_2Vukga3cc3ZhaG-mUzU` / `clients-jpv-bootcamp-app-tp9xrk` and deny-lists `web-public-jpv-bootcamp-l66egq`.

## Architecture decision

Prefer the existing S3 adapter when approved credentials and bucket configuration already exist. If they do not exist, use a staging-only persistent Dokploy volume mounted at `/app/public/media` as the smallest deployable fallback, while keeping the production deny-list intact.

## Plan

1. Verify the preview workflow's exact Dokploy deployment contract and safe configuration hooks.
2. Determine whether approved staging S3 credentials/resources exist without exposing values.
3. If S3 resources exist, activate the existing adapter with staging-only environment configuration.
4. Otherwise, add an idempotent staging-only volume-mount step to the preview workflow.
5. Validate workflow policy and repository tests.
6. Commit and deploy only the feature branch.
7. Upload one disposable media fixture through authenticated Payload API.
8. Restart or redeploy staging, verify the same asset remains retrievable, then delete it through Payload.
9. Preserve missing historical media records and report the final media verdict.

## Risks and safeguards

- Never call, inspect, restart, or modify the deny-listed production app.
- Never print credentials, tokens, bucket names, database URLs, or admin identities.
- Do not fabricate replacements for `proof-image-c3a1995.png` or `staging-proof-pixel.png`.
- Use idempotent infrastructure changes and explicit staging app checks.
- Make at most one bounded source repair per failed validation.

## Validation strategy

- Focused media-storage and staging-policy tests.
- Payload type-check and release validation for repository changes.
- Deployment health must report the new revision.
- Persistence proof requires upload, successful retrieval, one staging restart/redeploy, successful second retrieval, and supported cleanup.

## Completed implementation

- Added a pure staging-only mount contract at `scripts/staging-gates/dokployMediaMount.ts`.
- Added an idempotent Dokploy executor at `scripts/staging-gates/ensurePreviewMediaMount.mts`.
- Added focused regression coverage at `scripts/staging-gates/dokployMediaMount.test.ts`.
- Added the explicitly approved `Ensure durable staging media volume` step immediately before preview redeployment.
- The mount is restricted to application `clients-jpv-bootcamp-app-tp9xrk`, path `/app/public/media`, and named volume `jpv-bootcamp-preview-media`.
- Existing staging policy rejects the deny-listed production application and all unknown app IDs.
- Removed the temporary environment-presence checker; it will not be committed.

## Validation evidence

- Focused media mount test: passed.
- Existing staging policy suite: passed, 18 assertions.
- Payload TypeScript check: passed.
- Full release suite: passed, 158/158.
- Release suite included production build, workflow boundary checks, diff whitespace validation, dependency audit, and staging policy checks.
- Broad and secret-material scanners reported lexical findings for existing workflow secret references, existing `curl` calls, the intended `fetch` call, and `process.env.DOKPLOY_API_KEY`; manual review confirmed no literal credential, token, bucket, database URL, or admin identity is embedded in the changed paths.

## Rollback

Remove the workflow step and the three staging-gate files, then redeploy preview. The named volume should not be deleted during rollback unless an operator has separately confirmed no retained media is needed.

## Current task

Workflow `30629327456` deployed `d1f4869` successfully: the durable-volume and Dokploy-redeploy steps both passed. Disposable fixture `5` (`staging-media-durability-1785498577932.png`) was retrieved with authenticated access both before and after redeployment (68 bytes), then deleted through the supported Payload API. The record now returns 404; the authenticated asset URL is unavailable (non-success 500). Historical missing-media records were untouched. **PERSISTENT STORAGE VERIFIED.** Rollback: remove only the preview durable-volume workflow step and redeploy; do not delete the named volume unless retained media is separately confirmed unnecessary. Remaining manual check: verify dashboard/sidebar, Membership Audit History, course 3 Access Badge `manual`, and desktop/mobile clipping, focus, readability, and contrast.



## Deployment repair — 2026-07-31

- Commit `bd671a1` passed build and release checks but preview workflow run `30623502929` failed only at `Ensure durable staging media volume`; redeployment was skipped and staging remained on `5130191`.
- Root cause: the first implementation treated Docker service name `clients-jpv-bootcamp-app-tp9xrk` as Dokploy's internal `applicationId`. Repository infrastructure documentation identifies the internal staging ID as `I_2Vukga3cc3ZhaG-mUzU`.
- The bounded repair accepts either documented staging identifier for validation, rejects both documented production identifiers, and always uses the internal staging ID for `mounts.listByServiceId` and `mounts.create`.
- Repair validation passed: focused mount test, 18 staging-policy assertions, Payload type-check, production build, diff whitespace check, and full release suite 158/158.
- Changed-path secret scanning reported only the intentional `process.env.DOKPLOY_API_KEY` reference; manual review confirmed no literal credential or token is present.
- No production application call, inspection, restart, or deployment occurred.

## Next active task

Commit and push the validated identity repair, confirm the preview workflow creates or verifies the named volume and deploys the new revision, then execute the disposable upload/redeploy/retrieval/cleanup proof.
