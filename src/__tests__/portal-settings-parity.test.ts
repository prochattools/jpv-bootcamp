import { describe, expect, it } from 'vitest'

import { PortalSettings } from '@/globals/PortalSettings'

type FieldLike = {
  name?: string
  type?: string
  relationTo?: string
  admin?: Record<string, unknown>
  fields?: FieldLike[]
}

function fieldsByName(fields: FieldLike[] | undefined): Map<string, FieldLike> {
  return new Map((fields ?? []).filter((field) => field.name).map((field) => [field.name as string, field]))
}

describe('PortalSettings legacy parity contract', () => {
  it('registers the source-proven portal branding targets without legacy code execution fields', () => {
    expect(PortalSettings.slug).toBe('portalSettings')

    const fields = fieldsByName(PortalSettings.fields as FieldLike[])
    expect(fields.get('siteTitle')?.type).toBe('text')
    expect(fields.get('logo')?.relationTo).toBe('payload_media')
    expect(fields.get('whiteLogo')?.relationTo).toBe('payload_media')
    expect(fields.get('featuredImage')?.relationTo).toBe('payload_media')

    const loginBanner = fields.get('loginBanner')
    const bannerFields = fieldsByName(loginBanner?.fields)
    expect(bannerFields.get('logo')?.relationTo).toBe('payload_media')
    expect(bannerFields.has('titleColor')).toBe(true)
    expect(bannerFields.has('textColor')).toBe(true)
    expect(bannerFields.has('backgroundColor')).toBe(true)

    const loginForm = fields.get('loginForm')
    const formFields = fieldsByName(loginForm?.fields)
    expect(formFields.has('buttonLabel')).toBe(true)
    expect(formFields.has('buttonColor')).toBe(true)
    expect(formFields.has('buttonLabelColor')).toBe(true)

    const legacySettings = fields.get('legacySettings')
    expect(legacySettings?.type).toBe('json')
    expect(legacySettings?.admin?.hidden).toBe(true)
    expect(legacySettings?.admin?.readOnly).toBe(true)

    expect(fields.has('customCss')).toBe(false)
    expect(fields.has('customJs')).toBe(false)
  })
})
