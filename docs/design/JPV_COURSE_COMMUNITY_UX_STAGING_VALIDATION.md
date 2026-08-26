# JPV Course & Community UX — Staging Validation

**Date:** 2026-08-24

**Phase:** Product Experience Design Analysis — Phase 1

**Validation status:** PASS — authenticated member visual acceptance completed on the exact staging deployment

**Scope:** Staging verification only; no production, schema, migration, or feature changes

## Decision

The approved staging QA path is valid and authenticated member visual acceptance passed on 2026-08-24. The deployed revision contains bounded fixes for the observed acceptance blockers: billing presentation now preserves an active Payload billing overview, migrated Bunny media is rendered through an allowlisted structured embed, and the portal shell/top bar/community cards are bounded at narrow widths.

Fresh staging evidence confirms:

- billing no longer claims “No paid subscription found” while the active subscription is visible; the remaining syncing notice is truthful and non-blocking;
- migrated community post `81` renders one bounded Bunny iframe with its allowlisted source;
- the requested 320px, 375px, 768px, 1024px, and 1440px route matrix has no horizontal overflow or application errors;
- the authenticated course video remains bounded at 320px and desktop widths.

No reactions, sharing, bookmarks, new comments, billing actions, account changes, uploads, or LiveKit joins were performed. No production data or migrated production-like member was modified.

## Deployment evidence

| Evidence | Result |
| --- | --- |
| Branch | `feature/course-branding-and-preview` |
| Source commit | `f1aad07748868cf839c163d67be06a4dc533a565` |
| Remote feature tip | Matches source commit exactly |
| Staging URL | https://preview.jpvbootcamp.com |
| Deployment workflow | [GitHub Actions run 32673686200](https://github.com/prochattools/jpv-bootcamp/actions/runs/32673686200) |
| Workflow result | Success |
| Dokploy target | Canonical preview application only; staging boundary checks passed |
| Production | Not touched |

The workflow passed branch/SHA containment, build, deterministic release gate, immutable image publication, staging routing, Dokploy redeploy, exact revision wait, and the authenticated admin responsive gate. The workflow completed successfully; its optional authenticated admin failure-evidence upload was skipped because the gate passed.

## Live staging health

Fresh read-only checks confirmed:

- `GET /api/health` returned HTTP 200 with `status: live`, `deploymentEnv: staging`, and image/commit `f1aad07748868cf839c163d67be06a4dc533a565`.
- `GET /api/health/deployment` returned HTTP 200 with `ok: true`, `deploymentRuntime: docker`, and the same image tag.
- The deployment health response exposed exactly 36 migration inventory entries, from `20260620_213328` through `20260820_000000_live_session_space`. No migration command was run during this validation.
- `/health` is not an application endpoint and returned 404; `/api/health` is the authoritative health endpoint.

## QA access repair evidence

The dedicated staging QA member was inspected through the staging admin path before access repair:

| Check | Verified state |
| --- | --- |
| Identity | Dedicated staging QA member, Payload member ID `51`; not a migrated production-like member |
| Account status | `active` |
| Email verification | Verified on 2026-08-19 |
| Billing account | One active test-mode billing account |
| Subscription | One active annual JPV Bootcamp Membership subscription; current period end 2027-08-19 |
| Community access | One active membership in the Info Forum space |
| Course access before repair | No active enrollment for Property Investment Training — UK |

The approved staging QA password was repaired through the admin UI for member `51` only. The generated password is not recorded in this repository or dossier. Login was verified again on 2026-08-24 through the canonical member sign-in flow and reached `/portal` successfully. The protected session then reached the community, course, lesson, account, billing, and LiveKit routes without an authentication error; the video lesson rendered one video element and its existing discussion.

Because the lesson video endpoint requires an active course enrollment, one staging-only manual enrollment was added for this dedicated QA identity:

- enrollment record: `payload_course_enrollments` ID `76`;
- member: `51`;
- course: `3` (`propertytraining_uk`);
- status: `active`;
- source: `manual`;
- purpose metadata: controlled staging visual acceptance.

The only staging state changes made during this validation were the dedicated QA password repair and this enrollment. The enrollment did not alter a migrated member, subscription, schema, migration, production, or business logic. Both changes are intentionally recorded here for auditability without recording the password.

### Fresh post-repair access evidence — 2026-08-24

- Member login accepted the repaired credential and reached `/portal`.
- Admin read-only inspection of member `51` showed `active`, `Admin created`, and an email verification date of 2026-08-19; the member is the dedicated staging QA identity, not a migrated production-like member.
- The staging subscription list showed one active annual `JPV Bootcamp Membership` subscription for the QA identity, ending 2027-08-19.
- The authenticated community index showed the intended four accessible spaces: Member Discussion, Info Forum, Forum, and Templates & Forms Library (UK).
- Fresh authenticated route checks covered `/portal`, the UK course, both lesson routes, community, forum, discussions `66` and `81`, account, billing, and LiveKit. No application error or unauthorized redirect was observed.
- Billing showed `Subscription status` and the truthful `Billing status is syncing` notice, while the obsolete `No paid subscription found` message was absent.
- Discussion `81` rendered one structured, bounded Bunny embed (`222x125` at 320px) with the allowlisted `player.mediadelivery.net` source.
- The 320px forum check reported document/body scroll width `320px`; the first discussion card and navigation button stayed within the viewport (`44px` touch target, right edge `52px`).

No credential, cookie, session-store, production-like member, subscription, schema, migration, or business-logic change was made outside the dedicated QA password repair and the previously recorded QA enrollment.

## Routes and surfaces reviewed

### Public and authentication surfaces — PASS

Previously fresh-verified on the deployed SHA:

- `/`
- `/portal?mode=login`
- `/admin/login`

The public homepage and sign-in surfaces loaded with clear hierarchy and no observed overflow at 320, 375, 768, 1024, or 1440px.

### Authenticated member surfaces

| Surface | Evidence | Result |
| --- | --- | --- |
| Dashboard `/portal` | Sidebar, welcome/continue card, course cards, navigation reviewed at desktop and responsive matrix | PASS |
| Course `/portal/courses/propertytraining_uk` | Course hero, 47-lesson count, module accordions, progress panel, lesson links | PASS |
| Lesson with video `/portal/courses/propertytraining_uk/lessons/lesson-1-word-of-god` | Authenticated page rendered one video element; bounded 16:9 media container; discussion showed 2 comments | PASS |
| Text-only lesson `/portal/courses/propertytraining_uk/lessons/lesson-2-welcome-to-the-course` | Lesson and discussion rendered; no video is linked in the source record | PASS as text-only content, not video evidence |
| Community index `/portal/community` | Four unlocked/visible spaces, announcement cards, community resource state | PASS |
| Community feed `/portal/community/forum` | Visible post cards, author metadata, dates, excerpts, comment counts, progressive disclosure | PASS |
| Discussion `/portal/community/forum/posts/66` | Full post, two comments, rich-text emphasis, readable cards | PASS |
| Account `/portal/account` | Active status, verified email, profile/security controls, no unintended mutation | PASS |
| Billing `/portal/billing` | Active subscription context is visible; syncing warning is truthful and no false no-paid claim appears | PASS |
| LiveKit `/portal/live-sessions` | Page renders the enrolled-course eligibility message; no scheduled session was available for a join test | EVIDENCE LIMITED |

### Community media resolution

Post `81` (`Introduction`) contains a Payload `legacyHTML` block whose stored sanitized HTML includes an iframe and whose migration metadata identifies it as a migrated Bunny Stream preview video. The frontend now projects only the known Bunny embed shape into a structured player; arbitrary iframe HTML remains rejected. Fresh staging verification found one iframe, one `data-legacy-bunny-embed` wrapper, the expected allowlisted source, and no horizontal overflow.

### Billing resolution

The staging read-only API reports an active test-mode billing account and an active annual subscription for QA member `51`. The billing page now displays the active membership context and the truthful “Billing status is syncing” notice; “No paid subscription found” is absent. No Stripe or billing mutation was attempted. The operational projection warning remains visible as an evidence signal, not a contradictory entitlement claim.

### Admin surface — PASS

The deployment workflow's authenticated admin responsive gate passed all 14 tests across `/admin`, membership audit, and course collection views. This is CI evidence for the deployed revision, not a replacement for member-facing visual acceptance.

## Responsive evidence

The authenticated route matrix covered these 11 routes at 320, 375, 768, 1024, and 1440px (55 route/viewport checks):

- `/portal`
- `/portal/courses/propertytraining_uk`
- `/portal/courses/propertytraining_uk/lessons/lesson-1-word-of-god`
- `/portal/courses/propertytraining_uk/lessons/lesson-2-welcome-to-the-course`
- `/portal/community`
- `/portal/community/forum`
- `/portal/community/forum/posts/66`
- `/portal/community/forum/posts/81`
- `/portal/account`
- `/portal/billing`
- `/portal/live-sessions`

All 55 route/viewport combinations reached their intended authenticated route without an application error or unauthorized redirect. Each viewport reported document/body scroll width equal to the requested viewport width. The 320px forum check found the first discussion card within `16–304px` and the navigation control within `8–52px`; the lesson video was `222x125` and remained within the viewport. The 375, 768, 1024, and 1440px views were also coherent in the reviewed routes.

## Evidence references

- Phase 1 implementation contract: [JPV_COURSE_COMMUNITY_UX_IMPLEMENTATION.md](JPV_COURSE_COMMUNITY_UX_IMPLEMENTATION.md)
- Local Phase 1 responsive suite: `e2e/portal-courses-community.spec.ts` — 20 passed across 320, 375, 768, 1024, and 1440 project viewports.
- Deployment workflow log: [run 32673686200](https://github.com/prochattools/jpv-bootcamp/actions/runs/32673686200), including exact SHA wait and the authenticated admin responsive gate.
- Browser evidence captured in the validation transcript: authenticated dashboard, course, video lesson, community index, discussion, billing, LiveKit, 375px forum, and 320px forum screenshots.
- Read-only staging API evidence: member `51`, subscription/billing records, space membership, course enrollment `76`, course `3`, lesson `30`, lesson `31`, and community post `81`.

## Findings

### Passed

- Exact Phase 1 commit `f1aad07748868cf839c163d67be06a4dc533a565` is running in staging.
- Staging health and deployment provenance agree.
- Migration inventory remains at 36 entries; no migration execution occurred.
- Dedicated QA authentication was repaired and verified through the real member login flow.
- Course enrollment repair was limited to the dedicated staging QA member and is recorded above.
- Dashboard, course hierarchy, lesson discussion, course video container, community feed, migrated Bunny media, discussion cards, account surface, billing surface, and LiveKit page rendered without application errors.
- Authenticated route matrix completed at all requested widths with no horizontal overflow.
- Production branch and production environment were not targeted.

### Non-blocking evidence limitation

- No scheduled staging LiveKit session was available for a join-flow test. The eligibility page rendered the truthful “No live sessions are available for your enrolled courses” state without an application error. A future scheduled-session test can extend evidence, but it is not a blocker for this Phase 1 visual foundation acceptance.

## Required next action

Phase 1 course/community UX foundation is accepted in staging. Preserve this dossier as the fresh acceptance record. Do not proceed to reactions, sharing, bookmarks, or another UX phase without a separately approved scope; any future work must retain the staging-only boundary and rerun the affected checks.
