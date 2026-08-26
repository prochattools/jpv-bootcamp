---
name: JPV Bootcamp
description: A bright, purposeful design system for property education, membership, and community.
colors:
  brand-green: "#2C9E9E"
  brand-green-deep: "#144E4E"
  brand-green-bright: "#74C4C4"
  sunshine: "#E8C65A"
  sunshine-ink: "#6F5A1F"
  urgent-red: "#C94F4F"
  danger-surface: "#F8ECE8"
  danger-ink: "#78463D"
  canvas: "#FAF8F4"
  surface: "#F4F0E8"
  surface-strong: "#E9E2D5"
  ink: "#3A3428"
  muted: "#6E6350"
  border: "#D9CFBC"
typography:
  display:
    fontFamily: "Libre Baskerville, Georgia, serif"
    fontSize: "clamp(2.65rem, 6vw, 5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Libre Baskerville, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  detail: "4px"
  control: "8px"
  action: "8px"
  card: "10px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
  4xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.action}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "12px 24px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: JPV Bootcamp

> **Authority notice — 2026-08-23:** The single design-system authority is
> [JPV Design System Authority v1.0](docs/design/JPV_DESIGN_SYSTEM_AUTHORITY_V1.md),
> backed by `src/lib/brand/jpvDesignSystem.ts`. This document is supporting
> narrative only; its older palette prose must not override the executable
> teal/beige tokens.

## Overview

**Creative North Star: "The Sunlit Workshop"**

The executable source of truth is `src/lib/brand/jpvDesignSystem.ts`. Web layouts inject those tokens as CSS custom properties, Tailwind consumes the same radius values, Payload admin reads the same variables, and HTML email rendering imports the same typed values. Do not redefine brand colors or component radii in individual pages or templates.

**Design lock — approved 21 July 2026.** This is the final launch design. Future requests are iterations on this system, not authorization to redesign it. A redesign requires an explicit replacement brief and approval. Keep the approved landing-page composition, editorial/interface type pairing, spacing rhythm, visual hierarchy, and component vocabulary intact.

`jpvDesignSystem.ts` also owns the canonical brand name, tagline, logo path, logo alternative text, and web-to-email logo URL resolution. Frontend, authentication, portal, Payload, notifications, and email code must reference that authority. Tailwind's legacy neutral, semantic status, radius, and shadow aliases intentionally resolve to these tokens so existing application screens inherit the same system without page-local palettes. Intrinsic colors inside approved logo, illustration, and content artwork are the only asset-level exception.

JPV Bootcamp should feel like entering a practical workshop in clear daylight: optimistic, focused, and ready for real work. The public landing page may use a committed color strategy and more expressive pacing. Login, member, administrator, notification, and email surfaces use the same tokens with a restrained product treatment so important actions remain obvious.

The Kairos reference contributes whitespace, a compact header, concise section rhythm, alternating editorial compositions, restrained pricing, and a compact FAQ. JPV retains its own green-led identity and does not copy the reference's assets or claims.

Key characteristics:

- warm light surfaces with green-tinted neutrals;
- one green primary action vocabulary across every channel;
- sunshine for selective emphasis and red only for genuine errors or destructive states;
- one editorial serif and one geometric interface family with clear role separation;
- calm product shells and more expressive public-page composition;
- purposeful motion limited to opacity and transform, with reduced-motion support.

## Colors

The palette is bright without becoming noisy. Green carries identity and action; sunshine brings warmth; red communicates urgency only.

- **JPV Green** (`#2C9E9E`): primary calls to action, current selection, success accents, and high-value highlights.
- **JPV Green Deep** (`#144E4E`): accessible green text, strong borders, and pressed states on light surfaces.
- **JPV Green Bright** (`#74C4C4`): selective success and supporting accents, never large body text.
- **Sunshine** (`#E8C65A`) with **Sunshine Ink** (`#6F5A1F`): badges, section atmosphere, and supportive emphasis. Use the darker ink for readable text on light surfaces.
- **Urgent Red** (`#C94F4F`) with **Danger Surface** (`#F8ECE8`) and **Danger Ink** (`#78463D`): errors, destructive actions, and genuinely urgent notices. Always pair with text or an icon.
- **Canvas** (`#FAF8F4`): default page and email background.
- **Surface** (`#F4F0E8`) and **Surface Strong** (`#E9E2D5`): grouping and tonal elevation.
- **Ink** (`#3A3428`), **Muted** (`#6E6350`), and **Border** (`#D9CFBC`): warm neutral hierarchy. Muted text remains at least 4.5:1 against both Canvas and Surface.

Every final combination must meet WCAG AA. Focus uses a high-contrast green ring with a canvas offset. Disabled, warning, error, and success states use shape, copy, and iconography in addition to color.

## Typography

Libre Baskerville is the approved editorial family for public storytelling, authentication headings, and email headings. Poppins is the approved interface family for navigation, forms, member surfaces, administrator screens, notifications, and email body copy. Product dashboards use Poppins for operational clarity rather than applying serif type to dense controls.

- Display: 42-80px, 400 weight, tight tracking, balanced wrapping.
- Editorial section headline: 32-58px, 400 weight.
- Product page title: 30-40px, 600 weight in Poppins.
- Body: 16px minimum, 1.55-1.7 line height, 65-75 character measure.
- Label: 13px, 650 weight, uppercase only for short navigational or status labels.

Email clients that cannot load the web fonts use Georgia for editorial headings and Trebuchet MS or Arial for interface copy; structure and color remain coherent without remote font loading.

## Elevation

Elevation is mainly tonal. Use canvas, surface, and surface-strong before adding shadow. Raised authentication panels, pricing options, and email containers may use a subtle green-tinted ambient shadow. Avoid glow, glass, heavy drop shadows, and stacked nested cards.

Public sections vary between open canvas, soft surface, green, sunshine, and ink bands to create rhythm. Product surfaces stay predominantly canvas and surface with borders defining interactive regions.

## Components

- Primary buttons use JPV Green, Canvas text, an 8px action radius, a clear focus ring, a darker pressed state, and explicit loading/disabled labels.
- Secondary buttons use Canvas or transparent fill, a Border or Ink outline, and the same height and focus vocabulary.
- Inputs keep labels above controls, helper/error text below, 8px radii, and visible focus. Placeholders never replace labels.
- Cards and notices use 10px radii; large shells and dialogs use 14px. Full pills are reserved for compact badges, status chips, and avatars.
- Notices use a full border and tinted background. Errors and warnings state what happened and how to recover.
- Authentication uses a shared split shell: purpose/context on one side and the focused form on the other, collapsing to one column on mobile.
- Emails use a Canvas outer background, a centered container, branded masthead, short single-purpose body, one primary action, visible fallback URL when relevant, and a consistent footer.
- Notifications use the same semantic color, icon, heading, explanatory copy, and recovery-action vocabulary as their corresponding email or screen state.

Use 20px mobile gutters, 32px desktop gutters, a 72rem product shell, and an 80rem marketing shell. Controls are at least 44px high. Motion lasts 150-250ms on product surfaces and never blocks completion.

## Do's and Don'ts

Do:

- preserve existing authorization, checkout, support, delivery, and provider logic;
- use approved client copy and retain existing content where the brief is silent;
- show loading, success, error, empty, disabled, hover, active, and focus states;
- keep links and buttons explicit about their destination or result;
- verify narrow mobile, tablet, wide desktop, and representative email-client rendering.

Don't:

- invent testimonials, biographies, capabilities, outcomes, statistics, or legal claims;
- copy Kairos branding, photographs, course artwork, testimonials, code, or proprietary copy;
- use purple-blue gradients, neon glow, gradient text, decorative glass, or generic repeated card grids;
- add a new icon, animation, template, or email delivery dependency;
- change recipient safety, authentication decisions, billing behavior, migration state, or production deployment boundaries as part of design work.
