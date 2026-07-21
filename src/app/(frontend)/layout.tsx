import { Providers } from '@/components/providers'
import { jpvFont, landingSerif } from '@/fonts'
import { jpvCssVariables, jpvDesignTokens } from '@/lib/brand/jpvDesignSystem'
import { getSEOTags, renderSchemaTags } from '@/libs/seo'
import { Viewport } from 'next'
import { ReactNode } from 'react'

import '@/assets/styles/globals.scss'

export const viewport: Viewport = {
  themeColor: jpvDesignTokens.colors.canvas,
  width: 'device-width',
  initialScale: 1,
}

export const metadata = getSEOTags({ canonicalUrlRelative: '/' })

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={`${jpvFont.variable} ${landingSerif.variable}`}
      lang='en'
      style={jpvCssVariables}
      suppressHydrationWarning
    >
      <body className={jpvFont.className}>
        {renderSchemaTags()}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
