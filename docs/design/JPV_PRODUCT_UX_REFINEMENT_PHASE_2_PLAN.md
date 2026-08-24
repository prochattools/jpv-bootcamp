# JPV Product UX Refinement — Phase 2 Foundation Plan

**Date:** 2026-08-24
**Status:** PLAN READY FOR ACCEPTANCE — NO IMPLEMENTATION AUTHORIZED
**Phase:** Phase 2 — Product UX Refinement Foundation

## 1. Decision and authority

Phase 1 Course/Community UX Foundation is complete and remains closed. Phase 2
does not reopen the accepted responsive shell, scroll ownership, bounded media,
or community post-card work unless a new reproducible regression is found.

This document is the normative Phase 2 implementation plan. The narrower
authorities remain:

- docs/design/JPV_DESIGN_SYSTEM_AUTHORITY_V1.md — design-token authority;
- src/lib/brand/jpvDesignSystem.ts — executable runtime design authority;
- docs/design/JPV_COURSE_COMMUNITY_UX_STAGING_VALIDATION.md — Phase 1 staging evidence;
- docs/design/JPV_UX_ARCHITECTURE_CONSOLIDATION_PLAN.md — accepted shell foundation.

The earlier JPV_PRODUCT_UX_REFINEMENT_ROADMAP.md,
JPV_COURSE_COMMUNITY_EXPERIENCE_PLAN.md, and
JPV_PAYLOAD_CMS_UX_RECOMMENDATIONS.md are companion analyses. Their findings
are consolidated here and do not independently authorize work.

This plan does not authorize production work, migrations, schema changes,
billing or entitlement changes, new reactions/bookmarks/sharing/notifications,
moderation or LiveKit contract changes, or a broad visual redesign.

Current evidence boundary:

| Layer | Verified state |
| --- | --- |
| Staging application baseline | f1aad07748868cf839c163d67be06a4dc533a565 |
| Current local documentation commit | e215ef3782a2d5e6f1f93fcfac5c91a687d82a06 |
| Phase 1 acceptance | Authenticated route/viewport validation 55/55; release gate passed |
| Migration boundary | 36 staging inventory entries; no Phase 2 migration authorized |
| Production | Untouched and unauthorized |

## 2. Product problem and guardrails

The application has the core records and services for learning and community,
but members still assemble the intended journey from several equally weighted
sections. Phase 2 improves the order and interpretation of existing information
before adding more information or mutations.

Every implementation slice must answer:

1. What user problem does it solve?
2. What existing behavior does it preserve?
3. What evidence prevents regression?

If a signal is absent, the UI must omit the block or show a truthful empty
state. It must not invent recommendations, availability, entitlements, or
notifications.

## 3. Current UX assessment

### Course and learning

| Surface | Evidence and current pressure | Priority |
| --- | --- | --- |
| Dashboard | portal/page.tsx renders welcome, optional continueLesson, and up to four allowed course cards. The next action is not consistently composed with updates or live context. | P0 |
| Course overview | The course route renders cover, metadata, progress pills, module accordion, and a separate progress panel. Identity, progress, continuation, and curriculum compete. | P1 |
| Lesson | The lesson route renders context, title/summary/status, cover, bounded video, rich text, resources, discussion, completion, and previous/next navigation. Important actions are peer sections in a long document. | P0 |
| Lesson discussion | lessonDiscussion.ts already provides access checks, visible filtering, replies, historical authorship, rate limits, and audit events. The page needs a clearer discussion summary and next-action relationship. | P0 |
| Media/resources | LessonVideoPlayer, guarded resources, and member media components are working foundations. The contract must remain bounded, labeled, responsive, and access-safe. | P0 |

### Community and feed

| Surface | Evidence and current pressure | Priority |
| --- | --- | --- |
| Community home | communityPortal.ts projects access-safe spaces, announcements, and counts. Spaces, announcements, files, and discussions can have similar visual weight even though their jobs differ. | P0 |
| Space feed | Visible posts use current pinned/date ordering and CommunityPostCard now supplies author, type, date, excerpt, comment count, and read action. Priority, empty, locked, moderation, and call states still need one contract. | P0 |
| Post detail | The route renders safe rich text, attachments, comments, reply states, and moderation errors. The reading sequence and discussion summary need refinement. | P0 |
| Comments/replies | ProgressiveCommentList and service contracts preserve visibility, parent validation, moderation, rate limits, deep links, and historical timestamps. Disclosure must preserve that behavior. | P0 |
| Engagement | payload_space_reactions stores like, bookmark, and preserved survey_vote; bookmarks and leaderboard read projections exist. No approved member mutation/privacy/notification contract was found. | Dependency; no UI |

### Member portal information architecture

Existing navigation in PortalNavigation.tsx covers Dashboard, Courses, Live,
Updates, Community, Leaderboard, Bookmarks, Members, Partners, Account, and
Billing. Phase 2 does not remove or rename these routes. It clarifies:

    Dashboard → continue learning → eligible live/update context → destinations
    Courses → course progress → module/lesson → content → resources → discussion → completion
    Community → space purpose/access → pinned/latest → feed card → post → discussion/reply
    Account/Billing → identity → membership/billing state → truthful recovery/support action

### Payload/admin and design system

Payload remains the structured authoring and operations surface. Existing
collections cover courses, modules, lessons, enrollments, progress, resources,
videos, sessions, spaces, memberships, posts, comments, files, reactions, and
calls. Existing access rules keep direct member writes closed for core
collections; runtime writes go through services.

The operator opportunity is context, not schema invention: clearer labels and
descriptions, useful columns, safe preview conventions, and relationship context
where Payload already supports it. The member frontend remains responsible for
learning hierarchy, feed scanning, access explanation, discussion presentation,
and LiveKit continuity.

All Phase 2 composition consumes jpvDesignSystem.ts, semantic jpv-* utilities,
and existing buttons, inputs, dialogs, status, media, and disclosure primitives.
No local palette, competing radius/shadow scale, or second visual authority is
permitted. Primary controls retain the established 44px intent; keyboard focus,
non-color state communication, reduced motion, and WCAG target size remain
required.

## 4. Target architecture

### Learning

    Learning context: course → module → lesson → title, summary, duration, state
    Progress action: completion/progress → one Continue or Complete action
    Lesson body: bounded media → rich text → protected resources
    Discussion: count/first useful context → explicit expansion/reply
    Navigation: previous / next / return to course

The full body remains available; it does not become a hidden tab or modal.

### Community

    Community context: purpose → access → pinned/latest → call availability
    Feed: visible post projection → reusable card → empty/locked/moderation state
    Post: source/type/author/time → readable body/media → approved actions
    Discussion: compact summary → visible comments → expansion → contextual reply

The feed preserves current visibility and pinned/date ordering until a separate
decision approves filtering, ranking, sorting, or recommendation behavior.
No action row may imply a like, reaction, bookmark, share, or notification
mutation before the engagement contract gate.

### LiveKit

    scheduled → eligible → pre-join → joining → in-call → ended
                         ↘ denied / unavailable / token-error / cancelled

Each state needs an explanation and safe return destination. This is presentation
only; it does not change eligibility checks, room creation, or token issuance.

## 5. Component strategy

Reuse first:

- PortalShell, PortalTopBar, and PortalNavigation for shell and scroll ownership;
- CourseModuleAccordion for module/lesson interaction;
- LessonVideoPlayer, MemberContentMedia, and MemberFeaturedImage for bounded media;
- CommunityPostCard for the accepted feed-card foundation;
- CommunityRichText, CommunityLegacyHtml, and ProgressiveCommentList for safe body/disclosure behavior;
- StatusPill, JPV button/input/dialog primitives, and existing service projections.

Potential composition contracts are LearningContextHeader,
ProgressActionPanel, MediaFrame, DiscussionSummary, AccessState, and
LiveSessionState. These are not instructions to create files immediately. A
new abstraction is justified only when stable behavior is reused by at least
two surfaces and its props remain data/rendering focused.

## 6. Required workstreams

### P2-01 — Course learning hierarchy (first implementation slice)

**Problem:** Course identity, progress, content, discussion, and the next action
compete in a long lesson sequence.

**Plan:** Compose existing data into one learning context header, one primary
progress/continue/complete action, bounded media, readable body, secondary
resources, discussion summary, and previous/next navigation.

**Preserve:** access and lock states, preview/coming-soon states, video and
rich-text rendering, guarded resources, completion/progress services,
discussion behavior, and existing routes.

**Evidence:** allowed, locked, preview, coming-soon, completed, media, no-media,
resources, empty-discussion, and existing-discussion fixtures at
320/375/768/1024/1440px; keyboard/heading-order review; before/after progress
comparison.

### P2-02 — Community feed and discussion composition

**Problem:** Members need conversation context before opening every post, while
long threads can dominate the reading task.

**Plan:** Consume the accepted post card; make priority, space, author/time,
type, excerpt, media, count, and read action consistent; keep post detail calm;
show compact discussion summary with explicit expansion and contextual reply.

**Preserve:** visible-only filtering, pinned/date ordering, post types,
moderation, access, rate limits, historical authorship/timestamps, safe media,
deep links, and reply services.

**Evidence:** visible/pending/hidden/locked/empty/announcement/attachment/
legacy-media fixtures; parent/visibility tests; keyboard/deep-link disclosure
tests; the same responsive matrix.

### P2-03 — Portal next-action and state continuity

**Problem:** Dashboard, updates, billing, and LiveKit states are available but
are not consistently interpreted as one member journey.

**Plan:** Rank only existing signals: continue unfinished lesson; eligible
scheduled session; pinned/latest access-safe update; then course/community
destinations. Document syncing, locked, denied, ended, unavailable, and empty
states.

**Preserve:** navigation URLs, entitlement decisions, billing truth, LiveKit
eligibility/token boundaries, and account recovery behavior.

**Evidence:** no-signal, one-signal, multi-signal, locked course/space, billing
syncing, no-session, scheduled-session, denied-join, and recovery fixtures.

### P2-04 — Engagement contract gate (decision before UI)

The repository proves persistence/read projections, not approved member
semantics. Before any control is implemented, decide:

- like versus reaction set, and target scope (post/comment/lesson);
- one-member/one-target uniqueness and toggle/idempotency behavior;
- bookmark privacy and whether /portal/bookmarks is canonical;
- internal copy-link versus public sharing;
- hidden/deleted/locked effects on counts and member state;
- notification, analytics, audit, rate-limit, accessibility, and email scope.

**Preserve:** historical reaction records, leaderboard/bookmark reads,
moderation privacy, and the no-new-mutation boundary.

**Evidence:** written contract, service authorization/idempotency tests,
hidden/deleted target tests, and an explicit scope decision.

### P2-05 — Payload authoring and preview context

**Problem:** Operators can need domain knowledge to understand where a course,
space, post, media record, or relationship appears.

**Plan:** First use existing Payload descriptions, labels, columns, relationship
filters, safe preview links, and read-only context. Consider join fields only
when an observed lookup problem justifies them. Do not add schema fields as a
presentation shortcut.

**Preserve:** native Payload shell, access rules, hidden operational
collections, relationship ownership, protected media, and generated types.

**Evidence:** Payload config/type build, admin route smoke, preview access
boundary, relationship query check, and no schema/migration diff.

### P2-06 — Design-system and accessibility conformance

Use semantic JPV tokens, shared primitives, semantic headings, visible focus,
non-color states, reduced motion, bounded media, and the established control
intent. Preserve the Phase 1 shell and design authority.

Evidence is the design-token suite, accessibility/keyboard checks, focus
visibility, target-size/spacing checks, responsive matrix, and git diff --check.

## 7. Payload requirements and performance rules

Phase 2 consumes existing projections for course/lesson identity, lock and
preview state, progress, completion, managed media, protected resources, space
purpose/access, memberships, visible posts/comments, attachments, billing
state, and LiveKit state. If a required signal is absent, use a truthful empty
state or stop for a separate product/data decision.

Member reads continue through access-aware services. Direct collection writes
remain closed. Moderation, visibility, billing, entitlement, protected media,
and LiveKit credentials remain service-layer decisions.

Feed cards use bounded excerpts and metadata, not full rich text for every card.
Keep existing limits, pinned/date ordering, query deduplication, and counts.
Avoid N+1 relationship queries and unbounded nested comments. New queries
require before/after query-count or timing evidence. No indexes, fields,
collections, or migrations are part of the UX phase.

## 8. Ordered implementation plan

| Order | Slice | Entry dependency | Exit evidence | Boundary |
| --- | --- | --- | --- | --- |
| 0 | Contract/evidence gate | This plan accepted | Next-action, media, LiveKit, and engagement decisions; fixture matrix | No code/data changes |
| 1 | Course learning hierarchy | P2-01 decisions | Route, responsive, accessibility, progress/access evidence | Presentation only |
| 2 | Community composition | Phase 1 card/disclosure foundations | Feed/post/discussion/media matrix; access/moderation tests | No engagement mutations |
| 3 | Portal continuity | Existing dashboard/update/live/billing projections | Empty/one/many signal and state evidence | No recommendation engine or entitlement changes |
| 4 | Payload operator clarity | Observed operator friction | Admin build/smoke/preview evidence; no schema diff | Labels/descriptions/preview first |
| 5 | Engagement implementation, if approved | P2-04 contract | Service authorization/idempotency/privacy/audit evidence | Separate authorization required |
| 6 | Final verification | Approved slices complete | Design, accessibility, responsive, release, and staging evidence | No Phase 3 work |

The first implementation task after plan acceptance is P2-01 course learning
hierarchy, starting with lesson context/progress composition and fixtures.
Reuse Phase 1 components; do not reimplement them.

## 9. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Presentation exposes locked content or implies entitlement | Keep decisions in existing services; add allowed/denied fixtures |
| Engagement UI invents semantics | Contract gate before controls or mutations |
| Media dominates or leaks protected content | Bounded frames, allowlisted/guarded delivery, media-state matrix |
| Dashboard becomes a recommendation engine | Rank existing signals; omit absent blocks |
| Payload becomes a second frontend | Use native admin configuration; keep member composition custom |
| Rich cards create N+1 or oversized responses | Bounded projections, deduplication, limits, and query evidence |
| Local design drift | Token tests, shared primitives, source review, and diff review |
| Phase 1 regression | Preserve baseline evidence and rerun the 55-route matrix |

## 10. Acceptance criteria

Phase 2 foundation is complete only when:

- this file is accepted as the implementation authority for Phase 2;
- course, lesson, community, post, discussion, portal, and LiveKit states have one documented hierarchy;
- P2-01 through P2-03 are implemented with evidence or explicitly deferred with a named reason;
- P2-04 is decided before any reaction, bookmark, share, or notification controls;
- Payload remains schema-compatible and access-safe without migrations;
- all implemented UI consumes the JPV authority and existing primitives;
- course/community/media/access/moderation/progress/billing/LiveKit fixtures pass;
- responsive/accessibility evidence covers 320, 375, 768, 1024, and 1440px;
- release/documentation gates pass and production remains untouched.

This is a testable definition for future implementation, not a claim that Phase
2 is already complete.

## 11. Dependencies and next action

Before implementation, accept this plan and confirm:

1. dashboard next-action priority and absent-signal policy;
2. media presentation and fallback matrix;
3. LiveKit state and return-path model;
4. whether reactions/bookmarks/sharing/notifications are in current scope;
5. representative authenticated member and Payload operator fixtures.

After acceptance, implement only P2-01 course learning hierarchy in a bounded
slice. Add no schema, migration, mutation, or unrelated business logic. Run
focused tests before any staging deployment. Do not begin engagement controls or
another UX phase until the contract gate is accepted.

## 12. Research and evidence provenance

Repository evidence was inspected on 2026-08-24. External research informed
principles only; JPV does not copy another product's visual design.

- [Payload Collection Configs](https://payloadcms.com/docs/configuration/collections)
  — preview, live preview, searchable fields, list columns, pagination, and collection configuration.
- [Payload Join Field](https://payloadcms.com/docs/fields/join)
  — reverse relationship visibility without duplicate stored relationships.
- [Payload Preview](https://payloadcms.com/docs/admin/preview)
  — operator-to-frontend preview links and draft-preview concepts.
- [Payload Live Preview](https://payloadcms.com/docs/live-preview)
  — controlled in-admin rendering for safe preview use cases.
- [Teachable student dashboard principles](https://www.teachable.com/blog/student-success)
  — progress, next-lesson prompts, owned-course clarity, and reducing decision fatigue.
- [W3C WCAG 2.2](https://www.w3.org/TR/wcag/)
  and [WCAG 2.2 focus and target-size guidance](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
  — keyboard operation, focus visibility, and target-size constraints.

**Confidence:** high for repository inventory and JPV boundaries; standard for
comparative product principles; member and operator outcome claims remain to be
validated during implementation.

**Final decision:** this is the controlled Phase 2 implementation sequence
ready for stakeholder acceptance. No implementation starts from this document
alone.
