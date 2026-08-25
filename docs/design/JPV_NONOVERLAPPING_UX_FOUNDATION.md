# JPV non-overlapping UX foundation

Status: implementation branch
Branch: `codex/ux-foundation-nonoverlap`
Baseline: `4d8a0853afc79157c2f886bf4a44cf39a5731950`

## Purpose

This branch improves high-value UX areas that do not depend on the concurrent inline portal administration work. It is intentionally presentation-only: existing authentication, authorization, entitlement, routing, data fetching, API, persistence, and mutation contracts remain unchanged.

## Included surfaces

1. Authentication recovery and verification
   - Forgot-password, reset-password, set-password, and verification-resend feedback use one accessible success/error hierarchy.
   - Feedback announces the result, explains the next step, and provides a full-size recovery action where applicable.
2. Live-session continuity
   - `/portal/live-sessions`
   - `/portal/community/[spaceSlug]/calls`
   - `/portal/community/[spaceSlug]/calls/[sessionId]`
   - Live statuses, unavailable states, pre-join guidance, connection progress, join errors, and return paths are consistent.
3. Operator and review tables
   - `/admin/review`
   - `/admin/review/[sectionSlug]`
   - `/operations/partner-applications`
   - `/operations/partners-clicks`
   - Wide tables have a named, keyboard-focusable scroll region and a small-screen scroll cue.
4. Global recovery states
   - Frontend loading, error, and public information shells use dynamic viewport height.
   - Loading and live indicators respect reduced-motion preferences.

## Originally deferred while inline administration was in progress

These areas were excluded from the first UX commit. The inline-administration feature was subsequently merged into this branch and the combined route, responsive, authorization, and browser contracts were re-audited before integration:

- Course catalogue, course detail, module, lesson, and course-management UI under `src/app/(frontend)/portal/courses/**`.
- Community index, space, post, comment, discussion, moderation, and administration UI under `src/app/(frontend)/portal/community/**`, except the three dedicated `calls` routes listed above.
- Inline administration components under `src/components/portal/admin/**`.
- Portal administration services and endpoint contracts under `src/lib/portalAdmin/**` and related API routes.
- Portal chrome and admin-mode controls: `PortalTopBar`, `PortalShell`, `PortalNavigation`, and `PortalSidebar`.
- Shared primitives likely to generate merge conflicts: `src/components/ui/button.tsx`, dialog, input, sheet, switch, generic `Button.tsx`, `icon-button.tsx`, and `tailwind.config.ts`.
- Payload CMS administration, Stripe wiring, migration/import work, Bunny configuration, and all provider or schema changes.
- Homepage and broad visual redesign work; that remains a later design-system pass.

## Post-inline-administration UX pass

Completed on the combined candidate:

1. Merged the inline-administration feature into the UX audit branch without conflicts.
2. Re-ran focused UX, portal-admin, TypeScript, production-build, and browser checks on the combined tree.
3. Audited course and community routes at 320, 375, 768, 1024, and 1440 CSS pixels.
4. Preserved admin mode as an additive member-portal experience with server authorization authoritative for every mutation.
5. Preserved member ownership checks and admin moderation without Payload-admin redirects.
6. Enabled an authenticated admin to read lesson pages in the portal while keeping lesson completion and discussion mutations member-only.

The later visual-design pass remains separate from this functional UX consolidation.

## Acceptance contract

- No `/admin` redirect or Payload admin behavior is introduced by this branch.
- No role, entitlement, provider, schema, migration, or mutation behavior changes; the only access expansion is authenticated portal-admin read access to lesson pages.
- Auth responses retain privacy-safe messaging.
- Live-session status and recovery copy always gives a current state and next step.
- Wide data tables remain semantically valid and usable with keyboard and small screens.
- TypeScript, lint, production build, focused UX contracts, and repository release tests pass before handoff.
- Commits and integration require explicit authorization and exact-SHA validation; the current conversation provides that authorization for the feature-branch consolidation only.
