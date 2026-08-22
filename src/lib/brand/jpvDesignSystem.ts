export const jpvDesignTokens = {
  colors: {
    // Beige & Teal brand system (accent: #42BEBE)
    brand: '#42BEBE',        // teal-400 (lightened for contrast on dark backgrounds)
    brandHover: '#2C9E9E',   // teal-500
    brandDeep: '#1B6767',    // teal-700
    brandBright: '#74C4C4',  // teal-300
    sunshine: '#e8c65a',
    sunshineInk: '#6f5a1f',
    danger: '#c94f4f',
    dangerSurface: '#f8ece8',
    dangerInk: '#78463d',
    canvas: '#FAF8F4',       // beige-50 — page background
    surface: '#F4F0E8',      // beige-100
    surfaceStrong: '#E9E2D5', // beige-200
    ink: '#3A3428',          // beige-900 — primary text
    muted: '#6E6350',        // beige-700 (darkened from #A89A80 for WCAG AA)
    inverseMuted: '#5A4D3F', // beige-800 (darkened from #6E6350 for WCAG AA)
    border: '#D9CFBC',       // beige-300
    focus: '#238383',        // teal-600
    // Full teal scale
    teal50: '#EAF6F6',
    teal100: '#CFEAEA',
    teal200: '#A6D9D9',
    teal300: '#74C4C4',
    teal400: '#4EB0B0',
    teal500: '#2C9E9E',
    teal600: '#238383',
    teal700: '#1B6767',
    teal800: '#144E4E',
    teal900: '#0D3838',
    // Full beige scale
    beige50: '#FAF8F4',
    beige100: '#F4F0E8',
    beige200: '#E9E2D5',
    beige300: '#D9CFBC',
    beige400: '#C2B49B',
    beige500: '#A89A80',
    beige700: '#6E6350',
    beige900: '#3A3428',
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
    raised: '0 18px 50px rgba(44, 158, 158, 0.10)',
    floating: '0 24px 80px rgba(44, 158, 158, 0.18)',
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
  logoAlt: 'JPV — Our passion is people',
  logoPath: '/images/jpv-logo.jpg',
  logoHorizontalPath: '/images/jpv-logo-horizontal.png',
  logoTransparentPath: '/images/jpv-logo.png',
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
