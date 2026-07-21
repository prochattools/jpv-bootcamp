import { jpvBrand, jpvDesignTokens } from '@/lib/brand/jpvDesignSystem'

export type BrandedEmailAction = {
  label: string
  url: string
  tone?: 'primary' | 'secondary' | 'danger'
}

type BrandedEmailInput = {
  preheader: string
  heading: string
  /** Trusted internal markup only. Escape every dynamic value with escapeEmailHtml before interpolation. */
  bodyHtml: string
  actions?: BrandedEmailAction[]
  logoUrl?: string
  footerText?: string
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return character
    }
  })
}

function actionStyles(tone: BrandedEmailAction['tone']): string {
  const { colors } = jpvDesignTokens
  if (tone === 'danger') {
    return `background:${colors.danger};color:${colors.canvas};border:1px solid ${colors.danger};`
  }
  if (tone === 'secondary') {
    return `background:${colors.canvas};color:${colors.ink};border:1px solid ${colors.border};`
  }
  return `background:${colors.brand};color:${colors.canvas};border:1px solid ${colors.brand};`
}

function renderActions(actions: BrandedEmailAction[]): string {
  if (actions.length === 0) return ''

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px">${actions
    .map(
      (action) =>
        `<tr><td style="padding:0 0 10px"><a href="${escapeEmailHtml(action.url)}" style="${actionStyles(action.tone)}display:inline-block;border-radius:${jpvDesignTokens.radius.action};padding:12px 20px;font-size:14px;font-weight:600;line-height:20px;text-decoration:none">${escapeEmailHtml(action.label)}</a></td></tr>`,
    )
    .join('')}</table>`
}

export function renderBrandedEmail(input: BrandedEmailInput): string {
  const { colors, radius, typography } = jpvDesignTokens
  const logo = input.logoUrl
    ? `<img src="${escapeEmailHtml(input.logoUrl)}" width="64" height="64" alt="${escapeEmailHtml(jpvBrand.logoAlt)}" style="display:block;width:64px;height:64px;border:0;border-radius:${radius.card};object-fit:cover" />`
    : `<div style="font-family:${typography.emailEditorial};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${colors.ink}">${escapeEmailHtml(jpvBrand.name)}</div>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeEmailHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.surface};color:${colors.ink};font-family:${typography.emailInterface}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${colors.surface}">
      <tr>
        <td align="center" style="padding:28px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;overflow:hidden;border:1px solid ${colors.border};border-radius:${radius.panel};background:${colors.canvas}">
            <tr>
              <td style="height:8px;background:${colors.brand};font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 36px 10px">${logo}</td>
            </tr>
            <tr>
              <td style="padding:20px 36px 36px">
                <p style="margin:0 0 12px;color:${colors.brand};font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase">${escapeEmailHtml(jpvBrand.tagline)}</p>
                <h1 style="margin:0;color:${colors.ink};font-family:${typography.emailEditorial};font-size:34px;font-weight:400;line-height:1.15;letter-spacing:-0.03em">${escapeEmailHtml(input.heading)}</h1>
                <div style="margin-top:24px;color:${colors.ink};font-size:16px;line-height:1.7">${input.bodyHtml}</div>
                ${renderActions(input.actions ?? [])}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid ${colors.border};padding:22px 36px;color:${colors.muted};font-size:12px;line-height:1.6">
                ${escapeEmailHtml(input.footerText ?? `${jpvBrand.name} — Invest wisely, steward faithfully, bless generously.`)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
