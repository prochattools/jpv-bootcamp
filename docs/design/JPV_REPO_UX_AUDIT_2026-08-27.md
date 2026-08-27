# JPV repository UX audit — 27 August 2026
## Scope and evidence

This audit covers the public website, authentication screens, member portal, Payload admin, shared components, loading/error/not-found states, forms, notification surfaces, email-template sources, and course/media routes in the production-baselined repository.

The local inventory found:

- 69 frontend page routes, including 27 portal routes.
- 113 shared components.
- 588 form or interactive-element matches across the application source.
- 53 frontend files with page-local styling.
- 22 source files containing legacy raw colours or inactive `dark:` utility branches.

The current public production baseline renders the home page with no browser console errors or warnings. The repository graph was also refreshed locally with AST extraction. The optional semantic graph extraction could not run because its configured Bedrock backend lacks `boto3`; that is a tooling limitation, not an application finding.

## Findings

### P0 — consistency and state boundaries

The product has the correct conceptual separation between public light-only pages, an authenticated portal with a scoped theme toggle, and a Payload back office. The main risk is drift between those surfaces: legacy public components still contain inactive dark-mode branches, while portal and admin styling use a mixture of semantic JPV tokens and one-off values.

The implementation must keep these invariants:

1. Public, authentication, checkout, confirmation, and Payload pages are always light.
2. Only the authenticated member portal can switch between light and dark mode.
3. Portal theme state must remain scoped to the portal and default to light on a new portal session.
4. Existing routes, access rules, billing flows, course data, and admin capabilities remain available.

### P1 — shared layout and responsive behavior

Several shared shells use fixed or minimum widths that are fragile at narrow desktop/tablet breakpoints. The audit identified a 30rem minimum auth column, fixed-width mobile navigation content, wide data tables, course/media iframes, and live-call surfaces as areas requiring explicit containment. These need predictable local scrolling or wrapping rather than page-level horizontal overflow.

The portal shell also needs a clear skip target and non-clipped scroll affordance. The global stylesheet currently makes WebKit scrollbars zero-width, which removes a useful visual cue for long content.

### P1 — portal controls and feedback

The portal controls are functionally present, but some controls communicate state only through icons or colour. The theme toggle needs an accessible state label. The notification bell needs expanded-state semantics, a bounded mobile panel, and tab semantics that remain understandable without colour. The top bar should not create a competing second page heading.

### P1 — Payload navigation and density

The Payload workspace provides direct access to operational records through a grouped “All CMS records” area, so the simplification work must be presentation-first and must not hide or delete routes. The current navigation has excess vertical spacing, weak disclosure affordance contrast, and insufficiently compact grouping. The dashboard and collection surfaces also need consistent max-width, padding, focus, table, toast, and narrow-viewport rules.

### P2 — legacy styling and content surfaces

The public source contains legacy components with hard-coded colours and inactive dark-mode utilities. The active page shell already forces public light mode, but the dead branches increase the chance of future theme leakage and visual drift. Course content, rich text, tables, embeds, and preformatted content need shared max-width and overflow rules so an individual asset cannot widen the viewport or cut off adjacent controls.

### P2 — forms and state screens

Shared loading, error, not-found, information, auth, and dialog patterns are present, but page-local forms and confirmation states are not all governed by the same spacing and status conventions. The shared layer should establish consistent focus, disabled, notice, reduced-motion, and readable-content behavior; individual routes should continue to own their domain copy and actions.

## Change boundary for this pass

This pass applies cross-cutting UX improvements to shared tokens, global styling, portal shells/controls, and Payload navigation presentation. It does not rewrite domain workflows, move data between databases, alter billing/provider integrations, change access control, or remove direct CMS routes. Those are separate behavior or migration projects and require their own contracts and verification.

## Validation matrix

Before landing, validate:

- TypeScript, lint, targeted tests, and the repository build using the repository package scripts.
- No whitespace errors or unintended files in the feature worktree.
- Public and authentication routes stay light-only.
- Portal starts light, toggles to dark, and returns to light without leaving the portal shell.
- Portal notification and navigation controls remain keyboard-addressable and bounded at narrow viewports.
- Payload navigation keeps all operational routes reachable while presenting a tighter hierarchy.
- Production build and deployment workflow complete on the merged main commit.
- Live production identity and the public home page are verified after deployment; auth-gated surfaces are reported separately if a test session is unavailable.

## Follow-up implementation

The follow-up pass applies the shared fixes identified above:

- Tailwind `dark:` utilities are scoped to `.jpv-portal-theme-root.dark`, preventing legacy dark branches from activating on public, authentication, checkout, confirmation, or Payload screens.
- Rich text from community posts, migrated lessons, published member content, and course previews now uses one overflow-safe reading contract for headings, links, lists, images, video, iframes, code, and long tokens.
- Member/public form controls keep their width inside the available shell, while dialogs are bounded to the viewport and remain locally scrollable.
- The LiveKit container now establishes an explicit positioning and flex boundary so its video area can shrink and its chat panel remains reachable at desktop, tablet, and phone widths.
- The repository UX contract now guards these invariants against regression.

No domain behavior, route, access rule, billing integration, notification workflow, or migrated data was changed by this follow-up. Authenticated portal and Payload interaction still require an appropriately configured test session for end-to-end browser verification; the release report must distinguish that limitation from public-route evidence.
