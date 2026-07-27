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

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:28px 0 8px">${actions
    .map((action) => {
      const safeUrl = escapeEmailHtml(action.url)
      return `<tr><td style="padding:0 0 18px"><a class="jpv-email-action" href="${safeUrl}" style="${actionStyles(action.tone)}display:inline-block;border-radius:${jpvDesignTokens.radius.action};padding:12px 20px;font-size:14px;font-weight:600;line-height:20px;text-align:center;text-decoration:none">${escapeEmailHtml(action.label)}</a><p style="margin:10px 0 0;color:${jpvDesignTokens.colors.muted};font-size:12px;line-height:1.55">If the button does not work, copy and paste this link:<br /><a href="${safeUrl}" style="color:${jpvDesignTokens.colors.brand};word-break:break-all">${safeUrl}</a></p></td></tr>`
    })
    .join('')}</table>`
}

export function renderBrandedEmail(input: BrandedEmailInput): string {
  const { colors, radius, typography } = jpvDesignTokens
  const resolvedLogoUrl = input.logoUrl ?? jpvBrand.logoPath
  const logo = `<img src="${escapeEmailHtml(resolvedLogoUrl)}" width="64" height="64" alt="${escapeEmailHtml(jpvBrand.logoAlt)}" style="display:block;width:64px;height:64px;border:0;border-radius:${radius.card};object-fit:cover" />`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeEmailHtml(input.heading)}</title>
    <style>
      @media only screen and (max-width:620px) {
        .jpv-email-shell { padding:16px 10px !important; }
        .jpv-email-logo { padding:24px 22px 8px !important; }
        .jpv-email-content { padding:16px 22px 28px !important; }
        .jpv-email-heading { font-size:28px !important; line-height:1.2 !important; }
        .jpv-email-footer { padding:18px 22px !important; }
        .jpv-email-action { box-sizing:border-box !important; width:100% !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${colors.surface};color:${colors.ink};font-family:${typography.emailInterface}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${colors.surface}">
      <tr>
        <td class="jpv-email-shell" align="center" style="padding:28px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;overflow:hidden;border:1px solid ${colors.border};border-radius:${radius.panel};background:${colors.canvas}">
            <tr>
              <td style="height:8px;background:${colors.brand};font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td class="jpv-email-logo" style="padding:32px 36px 10px">${logo}</td>
            </tr>
            <tr>
              <td class="jpv-email-content" style="padding:20px 36px 36px">
                <p style="margin:0 0 12px;color:${colors.brand};font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase">${escapeEmailHtml(jpvBrand.tagline)}</p>
                <h1 class="jpv-email-heading" style="margin:0;color:${colors.ink};font-family:${typography.emailEditorial};font-size:34px;font-weight:400;line-height:1.15;letter-spacing:-0.03em">${escapeEmailHtml(input.heading)}</h1>
                <div style="margin-top:24px;color:${colors.ink};font-size:16px;line-height:1.7">${input.bodyHtml}</div>
                ${renderActions(input.actions ?? [])}
              </td>
            </tr>
            <tr>
              <td class="jpv-email-footer" style="border-top:1px solid ${colors.border};padding:22px 36px;color:${colors.muted};font-size:12px;line-height:1.6">
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
