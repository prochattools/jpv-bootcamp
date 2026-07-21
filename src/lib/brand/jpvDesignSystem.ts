export const jpvDesignTokens = {
  colors: {
    brand: '#2f805b',
    brandHover: '#276e4f',
    brandDeep: '#123d2d',
    brandBright: '#6bcf8a',
    sunshine: '#e8c65a',
    sunshineInk: '#6f5a1f',
    danger: '#c94f4f',
    dangerSurface: '#f8ece8',
    dangerInk: '#78463d',
    canvas: '#fffefa',
    surface: '#f5f3ec',
    surfaceStrong: '#e8ece7',
    ink: '#24332b',
    muted: '#687068',
    inverseMuted: '#c7d3cc',
    border: '#dedbd1',
    focus: '#123d2d',
  },
  radius: {
    detail: '4px',
    control: '8px',
    action: '8px',
    card: '10px',
    panel: '14px',
    pill: '999px',
  },
  shadow: {
    raised: '0 18px 50px rgba(18, 61, 45, 0.10)',
    floating: '0 24px 80px rgba(18, 61, 45, 0.18)',
  },
  typography: {
    interface: 'var(--font-jpv), Poppins, ui-sans-serif, system-ui, sans-serif',
    editorial: 'var(--font-jpv-landing-serif), "Libre Baskerville", Georgia, serif',
    emailInterface: "Poppins, 'Trebuchet MS', Arial, sans-serif",
    emailEditorial: "Georgia, 'Times New Roman', serif",
  },
} as const

export const jpvBrand = {
  name: 'JPV Bootcamp',
  tagline: 'Our passion is people',
  logoAlt: 'JPV Jesus Property Venture',
  logoPath: '/images/jpv-logo.jpg',
} as const

export function resolveJpvLogoUrl(baseUrl: string | URL): string {
  return new URL(jpvBrand.logoPath, baseUrl).toString()
}

export const jpvCssVariables = {
  '--jpv-brand': jpvDesignTokens.colors.brand,
  '--jpv-brand-hover': jpvDesignTokens.colors.brandHover,
  '--jpv-brand-deep': jpvDesignTokens.colors.brandDeep,
  '--jpv-brand-bright': jpvDesignTokens.colors.brandBright,
  '--jpv-sunshine': jpvDesignTokens.colors.sunshine,
  '--jpv-sunshine-ink': jpvDesignTokens.colors.sunshineInk,
  '--jpv-danger': jpvDesignTokens.colors.danger,
  '--jpv-danger-surface': jpvDesignTokens.colors.dangerSurface,
  '--jpv-danger-ink': jpvDesignTokens.colors.dangerInk,
  '--jpv-canvas': jpvDesignTokens.colors.canvas,
  '--jpv-surface': jpvDesignTokens.colors.surface,
  '--jpv-surface-strong': jpvDesignTokens.colors.surfaceStrong,
  '--jpv-ink': jpvDesignTokens.colors.ink,
  '--jpv-muted': jpvDesignTokens.colors.muted,
  '--jpv-inverse-muted': jpvDesignTokens.colors.inverseMuted,
  '--jpv-border': jpvDesignTokens.colors.border,
  '--jpv-focus': jpvDesignTokens.colors.focus,
  '--jpv-radius-detail': jpvDesignTokens.radius.detail,
  '--jpv-radius-control': jpvDesignTokens.radius.control,
  '--jpv-radius-action': jpvDesignTokens.radius.action,
  '--jpv-radius-card': jpvDesignTokens.radius.card,
  '--jpv-radius-panel': jpvDesignTokens.radius.panel,
  '--jpv-radius-pill': jpvDesignTokens.radius.pill,
  '--jpv-shadow': jpvDesignTokens.shadow.raised,
  '--jpv-shadow-floating': jpvDesignTokens.shadow.floating,
} as const

export type JpvCssVariables = typeof jpvCssVariables
