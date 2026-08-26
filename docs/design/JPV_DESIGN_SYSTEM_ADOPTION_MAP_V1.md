# JPV Bootcamp Design System Adoption Map v1.0

This map records how each existing surface consumes the authority in
`docs/design/JPV_DESIGN_SYSTEM_AUTHORITY_V1.md` and what remains for a later
consolidation/refinement pass. It does not authorize redesign or feature work.

| Surface | Current token source | Authority source | Adoption state | Risk |
|---|---|---|---|---|
| Public frontend | CSS variables, Tailwind JPV aliases, page-local legacy classes in older components | `jpvDesignSystem.ts` | Mostly aligned; legacy component inventory remains | Medium |
| Authentication | Frontend CSS variables, auth shell, portal branding defaults | `jpvDesignSystem.ts` and `portalSettings.ts` | Defaults consolidated to typed tokens; CMS-configured colors remain supported inputs | Low |
| Member portal | JPV Tailwind aliases, portal shell/classes, some shared primitive defaults | `jpvDesignSystem.ts` | Shared Button/Input primitives now consume JPV semantics; page audit remains | Medium |
| Community | Portal tokens plus rich-text renderer literals | `jpvDesignSystem.ts` | Partial; rich-text literal colors require later controlled review | Medium |
| Course surfaces | JPV semantic classes plus isolated media/player radii | `jpvDesignSystem.ts` | Mostly aligned; media/player exceptions require later inventory | Low |
| Payload/admin | `jpv-admin.scss` maps Payload theme variables to JPV variables | `jpvDesignSystem.ts` | Aligned mapping; duplicated elevation tables require review only | Low |
| Transactional emails | `brandedEmail.ts` typed values and inline email-safe styles | `jpvDesignSystem.ts` | Aligned for branded renderer; all alternate templates require inventory | Low |
| Sponsored/partner | JPV classes mixed with legacy page-local colors and disabled/preview states | `jpvDesignSystem.ts` | Partial; token drift remains, business behavior untouched | Medium |

## Safe consolidation completed

- Portal login branding fallback colors now import semantic values from
  `jpvDesignTokens` rather than duplicating hex values.
- Shared `Button` primitive variants now use JPV semantic colors, radius, and
  focus tokens instead of generic slate/dark-mode values.
- Shared `Input` primitive now uses JPV semantic surface, border, text,
  placeholder, radius, and focus tokens.
- Tailwind now exposes the canonical `jpv-focus` semantic color needed by the
  shared primitives.

## Remaining duplication inventory

- `old-tailwind.config.js` contains archived gradient/configuration values.
- Several older marketing/blog components contain literal colors and dark-mode
  palettes outside the JPV semantic system.
- `CommunityRichText.tsx` contains literal prose colors that need a deliberate
  content-rendering alignment pass.
- `src/lib/portal/portalSettings.ts` accepts persisted CMS color overrides by
  design; those values are user-configured data, not token authority.
- Payload admin elevation/status mappings repeat semantic formulas because the
  Payload theme API requires a scale; retain until a focused admin review.
- SVG/icon intrinsic colors are asset-level exceptions and should not be
  replaced automatically.

## Adoption rule

Future surface work must consume `jpvDesignTokens`, `jpvCssVariables`, or the
Tailwind JPV semantic aliases. Literal brand values require an explicit asset
or documented exception. This map should be updated before the separate final
Design Skill review begins.
