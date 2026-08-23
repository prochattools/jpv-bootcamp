# JPV Bootcamp Design System Authority v1.0

**Date:** 2026-08-23
**Status:** AUTHORITY ESTABLISHED — AUDIT AND GOVERNANCE ONLY
**Scope:** Public website, authentication, member portal, operator/admin
surfaces, Payload UI, forms, dialogs, sponsored surfaces, notifications, and
email templates

## 1. Purpose

This document establishes the single design-system authority to be consumed by
every JPV Bootcamp surface before the premium refinement pass. It records the
current executable token source, the approved semantic vocabulary, the current
surface adoption state, and the drift that must be resolved in later work.

It does not redesign pages, change product behavior, alter authentication or
billing, or authorize production work.

## 2. Authority hierarchy

1. **Executable authority:** `src/lib/brand/jpvDesignSystem.ts`
2. **Runtime CSS variable injection:** `jpvCssVariables` from the executable
   authority, injected by the frontend and Payload layouts
3. **Utility mapping:** `tailwind.config.ts`, which must resolve semantic
   utilities to `--jpv-*` variables
4. **Payload mapping:** `src/app/(payload)/jpv-admin.scss`, which must map
   Payload `--theme-*` variables to `--jpv-*`
5. **Email mapping:** branded email renderers must consume typed values from
   `jpvDesignTokens`; email-safe fallbacks are allowed but may not redefine
   brand semantics
6. **Documentation:** this document is the governance reference. `DESIGN.md`
   is supporting narrative and must not define a competing palette.

When sources conflict, the executable typed authority wins until an approved
versioned change updates it and this document together.

## 3. Brand and visual principles

- Product: **JPV Bootcamp**
- Tagline: **Our passion is people**
- Creative direction: **The Sunlit Workshop**
- Primary visual language: warm beige surfaces, teal action/identity color,
  sunshine for selective emphasis, red only for genuine danger/destructive
  states
- Public website: editorial, spacious, expressive within the same tokens
- Product surfaces: calm, dense enough for work, explicit hierarchy and state
- Email: resilient, table-based, inline-safe, with visible fallback URLs
- Accessibility: WCAG AA contrast, visible keyboard focus, non-color state
  communication, reduced-motion support

## 4. Canonical color tokens

These values are the current v1.0 authority from
`src/lib/brand/jpvDesignSystem.ts`.

| Semantic token | Value | Use |
|---|---|---|
| `brand` | `#2C9E9E` | primary identity and actions |
| `brandHover` | `#238383` | hover and focus-adjacent action state |
| `brandActive` | `#1B6767` | pressed/active action state |
| `brandDeep` | `#144E4E` | strong text, selected navigation, dark action |
| `brandDarkest` | `#0D3838` | deepest teal scale value |
| `brandLight` | `#74C4C4` | restrained accent on dark surfaces |
| `brandFaint` | `#EAF6F6` | subtle teal surface |
| `sunshine` | `#E8C65A` | badge and selective emphasis |
| `sunshineInk` | `#6F5A1F` | readable text on sunshine surfaces |
| `danger` | `#C94F4F` | errors and destructive actions |
| `dangerSurface` | `#F8ECE8` | error background |
| `dangerInk` | `#78463D` | readable error text |
| `canvas` | `#FAF8F4` | primary page/email background |
| `surface` | `#F4F0E8` | grouped surface and email outer background |
| `surfaceStrong` | `#E9E2D5` | elevated grouping |
| `ink` | `#3A3428` | primary text |
| `muted` | `#6E6350` | secondary text and metadata |
| `secondary` | `#6E6350` | secondary semantic text |
| `border` | `#D9CFBC` | borders and separators |
| `focus` | `#238383` | keyboard focus indicator |

The full teal and beige scales in the executable source are implementation
support values. Product code should prefer semantic names over raw scale names.

## 5. Typography authority

| Role | Authority | Use |
|---|---|---|
| Interface | `var(--font-jpv), Poppins, ui-sans-serif, system-ui, sans-serif` | navigation, forms, portal, admin, notifications, email body |
| Editorial | `var(--font-jpv-landing-serif), Libre Baskerville, Georgia, serif` | public storytelling and major headings |
| Email interface | `Poppins, Trebuchet MS, Arial, sans-serif` | email body and controls |
| Email editorial | `Georgia, Times New Roman, serif` | email headings where web fonts are unavailable |

Required role rules:

- Serif is reserved for editorial emphasis, not dense operational controls.
- Poppins/interface typography owns product clarity.
- Email must remain legible when web fonts are unavailable.
- Page-local font declarations require an explicit documented exception.

## 6. Spacing, shape, and elevation

| Category | v1.0 values |
|---|---|
| Detail radius | `4px` |
| Control/action radius | `8px` |
| Card radius | `10px` |
| Panel radius | `14px` |
| Pill radius | `999px`, badges/avatars only |
| Product gutters | `20px` mobile, `32px` desktop |
| Product shell | `72rem` |
| Marketing shell | `80rem` |
| Control minimum | `44px` target interactive height |
| Motion | `150–250ms`, opacity/transform only; respect reduced motion |

The existing `DESIGN.md` spacing scale remains the documented reference for
`4/8/16/24/32/48/64/96px` rhythm, but new work should expose semantic spacing
utilities rather than repeating arbitrary values.

Elevation is primarily tonal: canvas, surface, surface-strong, border, then
subtle teal-tinted shadows. Avoid glow, glass, heavy drop shadows, and nested
card stacks.

## 7. Component authority

| Component family | Canonical behavior |
|---|---|
| Primary button | brand background, canvas text, action radius, visible focus, pressed, loading, disabled |
| Secondary button | canvas/transparent fill, border or ink outline, same height/focus vocabulary |
| Input | label above, canvas background, ink text, control radius, helper/error below, visible focus |
| Card | card radius, tonal surface, border before shadow |
| Panel/dialog | panel radius, restrained elevation, keyboard escape/focus handling |
| Notice | border plus tinted background, semantic icon/copy, recovery action |
| Status | semantic color plus text/icon/shape; never color alone |
| Navigation | explicit selected state, keyboard focus, responsive collapse |
| Form state | loading, success, error, empty, disabled, retry semantics |

Current intended primitive locations include
`src/components/ui/*`, `src/components/Button.tsx`, `src/components/icon-button.tsx`,
`src/components/ui/AccessibleDialog.tsx`, `src/components/ButtonPopover.tsx`,
and the portal/auth form components.

## 8. Surface consumption contract

| Surface | Must consume |
|---|---|
| Public website | CSS variables, Tailwind semantic aliases, editorial/interface typography |
| Login/authentication | same tokens and shared form/focus vocabulary |
| Member portal | product shell, semantic surfaces, shared controls and states |
| Operator/admin portal | product semantics with operational density; no separate palette |
| Payload UI | `jpv-admin.scss` mapping from `--theme-*` to `--jpv-*` |
| Emails | typed color/radius/typography values with email-safe fallbacks and inline styles |
| Sponsored pages | same brand authority; sponsored eligibility/billing behavior remains unchanged |
| Popups/dialogs | shared radius, focus, overlay, action and responsive rules |

## 9. Audit findings — current implementation

### Aligned

- `jpvDesignSystem.ts` defines colors, radii, shadows, typography, brand
  metadata, and CSS variable names in one typed object.
- Frontend and Payload layouts inject the same CSS variables.
- `tailwind.config.ts` maps most semantic colors, radii, shadows, and fonts to
  those variables.
- Payload admin SCSS maps Payload theme variables to JPV variables.
- `brandedEmail.ts` consumes typed colors, radii, typography, and logo values.
- Email rendering includes email-safe fallbacks, inline styles, responsive
  behavior, and fallback URLs.

### Drift requiring later alignment work

- `src/components/ui/button.tsx` and `src/components/ui/input.tsx` still use
  slate/white utility classes and generic focus colors rather than the JPV
  semantic authority.
- `old-tailwind.config.js` contains a legacy multicolor gradient and must be
  treated as archived configuration, not an authority.
- `DESIGN.md` contains a later prose section with an older green/canvas palette
  that conflicts with the executable teal/beige values.
- Page-local class strings require a full inventory for literal colors,
  arbitrary spacing, radii, shadows, and one-off control variants.
- Payload SCSS has extensive semantic mapping, but its duplicated light/dark
  elevation tables should be checked for intentionality before refinement.
- Email templates outside `brandedEmail.ts` need an inventory to confirm they
  consume the same semantic values and do not hardcode competing colors.

These are audit findings only. No page or primitive has been changed by this
authority document.

## 10. Governance rules for v1.0

- Do not add a new color, font, radius, shadow, or spacing scale locally.
- Do not import `old-tailwind.config.js` into active build paths.
- Use semantic token names rather than raw hex values in UI code.
- Exceptions require a documented surface rationale and accessibility check.
- Any authority change must update `jpvDesignSystem.ts`, this document, and
  the relevant static/design tests together.
- Premium refinement is a separate implementation phase after the audit and
  approval of the alignment backlog.

## 11. Next assessment deliverables

Before implementation begins, produce:

1. A literal-style inventory by surface and file.
2. A primitive adoption map showing which pages bypass shared components.
3. A typography/spacing/radius consistency matrix.
4. An email and Payload-specific compatibility review.
5. A severity-ranked alignment backlog with no feature-scope expansion.
6. Static checks preventing new raw brand colors and competing token sources.

**Authority status:** v1.0 is established as the design governance baseline;
premium visual refinement is not yet implemented.
