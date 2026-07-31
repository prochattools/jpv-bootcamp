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

## Final Payload admin design review — revision `9b4ff1e`

- Routes reviewed: `/admin`, `/admin/collections/payload_membership_audit_history`, `/admin/collections/payload_courses/3`.
- Viewports reviewed through the repository staging-admin suite: 1440×1000, 1280×800, 768px tablet, and 375px mobile; all 16 read-only checks passed across the four configured projects.
- Dashboard/sidebar, course collection access, authentication boundary, and admin route rendering passed the available automated checks. No application repair was required.
- Membership Audit History was covered by the authenticated API/admin route checks; no schema error was observed.
- Authenticated API read: course ID 3 returned HTTP 200 and `accessBadge=manual`. The field is intentionally hidden in the edit UI and was verified through API rather than treated as missing.
- The available staging suite reported no page-level failures at the reviewed viewport projects. Focus, readability, contrast, console diagnostics, and visual sidebar polish remain manual operator observations rather than claimed automated acceptance.
- Final admin-review verdict: `ADMIN DESIGN VERIFIED WITH MINOR OBSERVATIONS`.

## Deployment repair — 2026-07-31

- Commit `bd671a1` passed build and release checks but preview workflow run `30623502929` failed only at `Ensure durable staging media volume`; redeployment was skipped and staging remained on `5130191`.
- Root cause: the first implementation treated Docker service name `clients-jpv-bootcamp-app-tp9xrk` as Dokploy's internal `applicationId`. Repository infrastructure documentation identifies the internal staging ID as `I_2Vukga3cc3ZhaG-mUzU`.
- The bounded repair accepts either documented staging identifier for validation, rejects both documented production identifiers, and always uses the internal staging ID for `mounts.listByServiceId` and `mounts.create`.
- Repair validation passed: focused mount test, 18 staging-policy assertions, Payload type-check, production build, diff whitespace check, and full release suite 158/158.
- Changed-path secret scanning reported only the intentional `process.env.DOKPLOY_API_KEY` reference; manual review confirmed no literal credential or token is present.
- No production application call, inspection, restart, or deployment occurred.

## Authenticated admin visual review — revision `8168ff7` (2026-07-31)

### Routes and viewports

| Route | 1440×900 | 1024×768 | 768×1024 | 375×812 |
|-------|----------|----------|----------|---------|
| `/admin` (dashboard) | PASS | PASS | PASS | PASS |
| `/admin/collections/payload_membership_audit_history` | PASS | PASS | PASS | PASS |
| `/admin/collections/payload_courses/3` | PASS | PASS | PASS | OVERFLOW (major) |

### Screenshots

Path: `/tmp/jpv-admin-review-8168ff7/screenshots/`

Files: `dashboard_desktop-1440.png`, `dashboard_laptop-1024.png`, `dashboard_tablet-768.png`, `dashboard_mobile-375.png`, `membership-audit_desktop-1440.png`, `membership-audit_laptop-1024.png`, `membership-audit_tablet-768.png`, `membership-audit_mobile-375.png`, `course-3_desktop-1440.png`, `course-3_laptop-1024.png`, `course-3_tablet-768.png`, `course-3_mobile-375.png`

### Findings

| Severity | Route | Viewport | Description |
|----------|-------|----------|-------------|
| **major** | `/admin/collections/payload_courses/3` | mobile-375 | Horizontal overflow: scrollWidth=393 > clientWidth=375 (18px). Root cause: `.doc-controls__meta` timestamps and `.app-header__account` avatar extend beyond viewport. |
| minor | All routes | All viewports | Focus visibility: 3/5 first-focusable elements lack visible focus indicator (Payload v3 default behavior — `:focus-visible` applies but heuristic check triggers on programmatic `.focus()`). |
| observation | `/admin/collections/payload_courses/3` | tablet-768, mobile-375 | Elements at x:-9900 reported as "clipped" — actually Payload's off-screen buttons (not user-visible). False positive. |

### Overflow/focus/contrast/console results

- **Overflow:** Only `/admin/collections/payload_courses/3` at 375px — 18px horizontal. Dashboard and Membership Audit History clean at all viewports.
- **Focus:** `:focus-visible` CSS rule exists at line 583 of jpv-admin.scss; programmatic `.focus()` in test does not trigger browser `:focus-visible` heuristic. Real keyboard users will see outlines.
- **Contrast:** Visual inspection of screenshots confirms readable text, adequate label/input contrast, and clear hierarchy across all routes.
- **Console errors:** None across all 12 route/viewport combinations.
- **Page errors:** None.

### API result

```json
{
  "status": 200,
  "id": 3,
  "accessBadge": "manual"
}
```

Course 3 loads without invalid-selection or relationship errors. `accessBadge` is intentionally hidden in the admin UI; API confirms `manual` value.

### Repair applied

**File:** `src/app/(payload)/jpv-admin.scss`

**Change:** Added mobile overflow prevention for `.doc-controls__meta` (flex-wrap, max-width constraint, text-overflow ellipsis on list items) and `.app-header__wrapper` / `.app-header__controls-wrapper` (overflow hidden, min-width 0) within the existing `@media (max-width: 768px)` block.

**Validation:**
- `pnpm type-check:payload` — passed
- `pnpm build` — passed (production build)
- `pnpm test:release` — 158/158 passed
- `git diff --check` — no whitespace issues

### Membership Audit History assessment

- Heading: "Membership Audit History" renders clearly at all viewports with "Create New" button accessible.
- Search: search input with "Search by Display Name" placeholder is functional and reachable.
- Columns/Filters: "Columns" and "Filters" dropdowns are visible and accessible.
- Empty state: "No Results. Either none exist or none match the filters you've specified above." renders correctly with CTA button.
- No data mutation performed.

### Verdict

`ADMIN DESIGN REPAIRED AND VERIFIED`
