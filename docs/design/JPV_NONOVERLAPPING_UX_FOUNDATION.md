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

## Explicitly deferred: Claude Code-owned work

Do not resolve these areas in this branch. Re-audit them after Claude Code finishes and its branch is merged:

- Course catalogue, course detail, module, lesson, and course-management UI under `src/app/(frontend)/portal/courses/**`.
- Community index, space, post, comment, discussion, moderation, and administration UI under `src/app/(frontend)/portal/community/**`, except the three dedicated `calls` routes listed above.
- Inline administration components under `src/components/portal/admin/**`.
- Portal administration services and endpoint contracts under `src/lib/portalAdmin/**` and related API routes.
- Portal chrome and admin-mode controls: `PortalTopBar`, `PortalShell`, `PortalNavigation`, and `PortalSidebar`.
- Shared primitives likely to generate merge conflicts: `src/components/ui/button.tsx`, dialog, input, sheet, switch, generic `Button.tsx`, `icon-button.tsx`, and `tailwind.config.ts`.
- Payload CMS administration, Stripe wiring, migration/import work, Bunny configuration, and all provider or schema changes.
- Homepage and broad visual redesign work; that remains a later design-system pass.

## Post-Claude UX pass

After the concurrent branch lands:

1. Rebase or merge this branch and resolve conflicts without dropping either branch's behavioral tests.
2. Re-run the full release suite and production build on the combined tree.
3. Audit every deferred route at 320, 375, 768, 1024, and 1440 CSS pixels.
4. Verify admin mode remains an additive member-portal experience, while server authorization remains authoritative for every mutation.
5. Verify members can edit/delete only their own eligible content and admins can moderate without Payload-admin redirects.
6. Perform the later UI/design-system pass only after functional staging acceptance.

## Acceptance contract

- No `/admin` redirect or Payload admin behavior is introduced by this branch.
- No access, role, entitlement, provider, schema, migration, or mutation behavior changes.
- Auth responses retain privacy-safe messaging.
- Live-session status and recovery copy always gives a current state and next step.
- Wide data tables remain semantically valid and usable with keyboard and small screens.
- TypeScript, lint, production build, focused UX contracts, and repository release tests pass before handoff.
- This branch is not committed, pushed, merged, or deployed without separate authorization.
