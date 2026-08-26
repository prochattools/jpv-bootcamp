# JPV Bootcamp — Design Token Reconciliation Report

**Date:** 2026-08-23
**Authority:** `docs/design/JPV_DESIGN_SYSTEM_AUTHORITY_V1.md`
**Executable source:** `src/lib/brand/jpvDesignSystem.ts`
**Status:** AUDIT COMPLETE — CURRENT LAUNCH SURFACES ALIGNED; LEGACY RESIDUE DISPOSITIONED

## Executive decision

**No. JPV Bootcamp is not yet using one unified design authority across the
entire repository.** The current launch routes for the modern frontend, portal,
Payload admin, email renderer, and audited shared primitives use the JPV
authority. Retained legacy public/marketing, blog, waiting-list, and selected
component sources still contain competing palettes and local style sources;
their current-route status is recorded in the matrix below.

No redesign, feature work, business-logic change, migration, or new deployment
was performed as part of this reconciliation report.

## Scan coverage

| Measure | Result |
|---|---:|
| Repository files under scan roots | 1,248 |
| Active CSS/SCSS files | 4 |
| Primary typed design authority sources | 1 |
| Tailwind configuration sources | 2 (`tailwind.config.ts`, archived `old-tailwind.config.js`) |
| Active JPV CSS-variable consumers | frontend globals/landing, Payload admin, portal/layout surfaces |
| Design/email test files located | 14+ |
| Hex literal occurrences in source/docs scan | broad inventory; dominant legacy clusters listed below |

The scan covered `src`, `app`, `components`, `docs`, Tailwind configuration,
CSS/SCSS, email renderers/templates, Payload styling, shared primitives, and
public surface components.

## Current launch-route verification

The final route-scoped scan covered `src/app/(frontend)` and
`src/app/(payload)` for raw hex/rgb/hsl values and competing generic
blue/gray/red utility states. No remaining matches were found after the
bounded consolidations in this report. The remaining matches in the broader
repository are retained legacy components, archived configuration, email-safe
fallbacks, CMS data inputs, or functional media/artwork exceptions listed
below.

## Authority inventory

| Token domain | Canonical source | Competing sources found | Result |
|---|---|---|---|
| Colors | `jpvDesignSystem.ts` → `jpvCssVariables` | retained legacy component literals, old Tailwind palette, bounded fallback utility aliases | Current launch surfaces aligned; repository residue remains |
| Typography | typed interface/editorial/email families | `Inter`, `font-inter`, local font declarations, arbitrary weights/sizes | Not unified |
| Spacing | Tailwind utilities plus documented rhythm | arbitrary `px`, `py`, `gap`, and page-local values | Partially unified |
| Radii | typed radius tokens + Tailwind `rounded-jpv-*` | `rounded-[...]`, `rounded-xl`, `rounded-[40px]`, local SCSS | Not unified |
| Shadows | typed JPV shadows + Tailwind JPV aliases | `shadow-2xl`, `shadow-lg`, `shadow-xl`, `shadow-3xl`, local shadows | Not unified |
| Motion | existing utility transitions and JPV guidance | page-local durations/scales and legacy transforms | Partially unified |
| Breakpoints | Tailwind config | page-local responsive behavior, no competing breakpoint config found | Mostly unified |
| Semantic states | JPV danger/sunshine/brand aliases | raw red/green/blue palettes and dark-mode legacy states | Not unified |

## Domain reconciliation matrix

| Domain | Current visual source | Expected authority | Deviations | Intentional exceptions | Migration required | Risk |
|---|---|---|---|---|---|---|
| Public homepage/marketing | Current homepage uses JPV aliases and JPV CSS variables; retained legacy components use blue/green/dark palettes | `jpvDesignSystem.ts` | retained legacy files retain `#1364FF`, `#1AAB12`, `#010814`, neutrals, gradients | Approved artwork intrinsic colors only; legacy files are not imported by current homepage route | Quarantine or component-by-component migration before reuse | Medium |
| Navigation | Current homepage/portal navigation uses JPV aliases; retained `Header.tsx` uses legacy classes | JPV variables/Tailwind aliases | white/dark navy backgrounds, legacy borders in retained header | `Header.tsx` is only referenced by compatibility waiting-list layout | Quarantine or migrate before reuse | Medium |
| Blog/content | Current `/blog` route uses the JPV public information shell; retained blog components/styles are legacy | JPV variables with content-safe exceptions | retained `BlogCard`/older blog components contain legacy values; active `BlogMoreArticles` and blog stylesheet are aligned | syntax highlighting/content artwork may remain | Quarantine or migrate before reuse | Medium |
| Authentication | auth shell and frontend variables; portal CMS branding defaults | JPV authority plus intentional CMS color inputs | persisted CMS values can override defaults | CMS-configured branding is intentional | Defaults already consolidated; audit runtime overrides | Medium |
| Member portal | JPV classes and shared primitives | JPV authority | isolated neutral/white/radius/shadow classes remain | media player black surface is functional | Limited cleanup | Medium |
| Community | portal tokens plus `CommunityRichText.tsx` | JPV semantic text/border tokens | active renderer now uses JPV semantic text/border aliases | rich-text content semantics may need content-specific mapping | Verify | Low |
| Course surfaces | mostly JPV aliases | JPV authority | isolated `rounded-2xl`, black media surface, arbitrary sizes | video/media surface black is functional | Limited cleanup | Low |
| LiveKit | portal/call components and JPV aliases | JPV authority | no competing token object found; live state needs visual verification | media/video black surface | Audit only | Low |
| Payload/admin | `jpv-admin.scss` maps Payload variables to JPV variables | JPV authority | duplicated elevation/status scale formulas | Payload requires generated scale mapping | No immediate change | Low |
| Transactional email | `brandedEmail.ts` typed inline values | JPV authority + email-safe fallbacks | alternate template inventory still required | inline styles and email-safe fonts are intentional | Audit alternate templates | Low |
| Sponsored/partner | JPV classes mixed with older page-local values | JPV authority | legacy form/page colors and local focus classes | CMS/business status colors only when semantic | Yes | Medium |

## Legacy residue inventory

### Confirmed competing palettes

- Blue action palette: `#1364FF`, `#006fee`, related dark navy surfaces.
- Green palette: `#1AAB12`, `#49c172`, `#6bcf8a`, `#2f805b`.
- Legacy dark palette: `#010814`, `#0B111B`, `#1E242D`, `#373C53`.
- Legacy gray palette: `#7B7E83`, `#808389`, `#4D525A`, `#5A5E66`, `#86898E`.
- Older content-renderer palette: `#68766f`, `#153f2e`, `#d9c897`, `#51645b`.
- Older danger palette: `#EA2222`, `#E93737`, `#FDE9E9`, `#D40404`.

### Confirmed competing configuration/documentation

- `old-tailwind.config.js` contains a legacy multicolor gradient and is not
  part of the executable authority.
- `DESIGN.md` contains older palette prose; it now explicitly defers to the
  v1.0 authority but the prose remains historical and should be cleaned in a
  later documentation-only pass.
- `src/assets/styles/blog-page.scss` was a separate styling island; its active
  shell, links, surfaces, radius, and shadow values now consume JPV variables.

### Local token patterns

- The audited shared primitives (`navigation-menu`, `badge`, `accordion`,
  `slider`, `avatar`, and `card`) now consume JPV semantic aliases for their
  previously competing slate/brand values.
- Page components use arbitrary radii (`rounded-[12px]`, `rounded-[20px]`,
  `rounded-[40px]`), shadows, and spacing. These are not automatically safe to
  replace without a surface-by-surface visual review.
- SVG/icon intrinsic colors are asset-level exceptions and are not token
  contradictions unless the icon is a product UI state icon.

## Contradictions resolved in this reconciliation

This pass also redirected the active blog styling island and related article
cards to the existing authority without changing layout or behavior:

- `src/assets/styles/blog-page.scss` now uses JPV CSS variables for body,
  links, code, quote, FAQ surface, radius, and shadow semantics.
- `src/components/BlogMoreArticles.tsx` now uses JPV surface, border, text,
  radius, and shadow aliases.
- `src/components/community/CommunityRichText.tsx` now uses JPV semantic
  aliases for active paragraph, heading, link, quote, and list rendering.
- `src/app/(frontend)/landing.module.scss` now derives active homepage overlays,
  shadows, and inverse text from JPV variables rather than local color/shadow
  literals.
- Active LiveKit/video fallback states now use JPV semantic aliases instead of
  generic blue/gray/red utility colors.

The previous safe consolidation remains valid:

- portal fallback defaults import typed JPV tokens;
- shared Button/Input use JPV semantic aliases;
- Tailwind exposes the JPV focus alias;
- authority and adoption documentation are present.

The remaining legacy clusters are broad surface changes and would constitute a
visual refinement/consolidation pass rather than a safe blind replacement.

## Intentional exceptions

- CMS-configured portal branding values remain configurable data and must not
  be removed merely to force static tokens.
- Email inline styles and email-safe font fallbacks are required by email
  clients, but their semantic values must come from the typed authority.
- Black video/player surfaces are functional media presentation surfaces.
- Brand/artwork/icon intrinsic colors may remain inside approved assets.
- Syntax highlighting and user-authored rich-text content may use a bounded
  content palette if separately documented and contrast-checked.

## Remaining risks

1. Retained legacy public/marketing components can diverge from the JPV
   authority if reintroduced without migration; they are not imported by the
   current launch routes.
2. CMS-configured branding and email-safe inline fallbacks remain intentional
   runtime exceptions and require verification rather than replacement.
3. The old Tailwind file can mislead future contributors despite being
   archived.
4. A visual regression suite has not yet proven all public/auth/portal/admin/
   email surfaces against the authority.
5. The deployment workflow previously started for consolidation must not be
   treated as design verification until its exact SHA and staging evidence are
   confirmed.

## Required next sequence

1. Approve a bounded legacy-surface consolidation scope.
2. Replace legacy token references by surface, preserving layout and behavior.
3. Add static checks preventing new competing brand colors in active UI paths.
4. Complete exact-SHA staging deployment and visual acceptance.
5. Run the final Design Skill review.

**Final decision:** Yes for the current launch UI surfaces: the active frontend,
authentication, portal, community, course/LiveKit, Payload/admin, email, and
sponsored/partner route code now consumes the JPV authority or an explicitly
documented intentional exception. Repository-wide source hygiene is not
identical because retained legacy files and archived configuration remain, but
they are dispositioned as non-executable residue and must not be reused without
migration. This proves authority alignment for the current UI surfaces; it does
not yet constitute visual staging acceptance or the final Design Skill review.
