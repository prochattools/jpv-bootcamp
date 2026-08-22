import config from '@payload-config'
import { getPayload } from 'payload'

import { jpvBrand } from '@/lib/brand/jpvDesignSystem'
import { resolveMemberMediaAsset } from '@/lib/payloadContent/memberMedia'

export type PortalLoginBranding = {
  siteTitle: string
  logoUrl: string
  bannerTitle: string
  bannerDescription: string
  bannerTitleColor: string
  bannerTextColor: string
  bannerBackgroundColor: string
  formTitle: string
  formDescription: string
  formTitleColor: string
  formTextColor: string
  formBackgroundColor: string
  buttonLabel: string
  buttonColor: string
  buttonLabelColor: string
}

const DEFAULTS: PortalLoginBranding = {
  siteTitle: 'JPV Bootcamp',
  logoUrl: jpvBrand.logoPath,
  bannerTitle: 'Welcome to JPV Bootcamp - Portal',
  bannerDescription: 'Join our community and start your journey to success',
  bannerTitleColor: '#FAF8F4',
  bannerTextColor: '#FAF8F4',
  bannerBackgroundColor: '#1B6767',
  formTitle: 'Login to JPV Bootcamp - Portal',
  formDescription: 'Enter your email and password to login',
  formTitleColor: '#3A3428',
  formTextColor: '#6E6350',
  formBackgroundColor: '#FAF8F4',
  buttonLabel: 'Login',
  buttonColor: '#2C9E9E',
  buttonLabelColor: '#FAF8F4',
}

function asText(value: unknown, fallback: string, maxLength = 300): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback
}

function asHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback
}

export async function getPortalLoginBranding(): Promise<PortalLoginBranding> {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({
      slug: 'portalSettings' as any,
      depth: 1,
      overrideAccess: true,
    } as any) as unknown as Record<string, unknown>
    const banner = settings.loginBanner && typeof settings.loginBanner === 'object'
      ? settings.loginBanner as Record<string, unknown>
      : null
    const form = settings.loginForm && typeof settings.loginForm === 'object'
      ? settings.loginForm as Record<string, unknown>
      : null
    const bannerLogo = banner
      ? await resolveMemberMediaAsset(payload, banner.logo)
      : null
    const primaryLogo = await resolveMemberMediaAsset(payload, settings.logo)

    return {
      siteTitle: asText(settings.siteTitle, DEFAULTS.siteTitle, 120),
      logoUrl: bannerLogo?.url ?? primaryLogo?.url ?? DEFAULTS.logoUrl,
      bannerTitle: asText(banner?.title, DEFAULTS.bannerTitle, 160),
      bannerDescription: asText(banner?.description, DEFAULTS.bannerDescription, 600),
      bannerTitleColor: asHexColor(banner?.titleColor, DEFAULTS.bannerTitleColor),
      bannerTextColor: asHexColor(banner?.textColor, DEFAULTS.bannerTextColor),
      bannerBackgroundColor: asHexColor(banner?.backgroundColor, DEFAULTS.bannerBackgroundColor),
      formTitle: asText(form?.title, DEFAULTS.formTitle, 160),
      formDescription: asText(form?.description, DEFAULTS.formDescription, 600),
      formTitleColor: asHexColor(form?.titleColor, DEFAULTS.formTitleColor),
      formTextColor: asHexColor(form?.textColor, DEFAULTS.formTextColor),
      formBackgroundColor: asHexColor(form?.backgroundColor, DEFAULTS.formBackgroundColor),
      buttonLabel: asText(form?.buttonLabel, DEFAULTS.buttonLabel, 60),
      buttonColor: asHexColor(form?.buttonColor, DEFAULTS.buttonColor),
      buttonLabelColor: asHexColor(form?.buttonLabelColor, DEFAULTS.buttonLabelColor),
    }
  } catch {
    return { ...DEFAULTS }
  }
}
