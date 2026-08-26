import type React from 'react'
import { RootLayout } from '@payloadcms/next/layouts'
import config from '@payload-config'
import { jpvFont } from '@/fonts'
import { jpvCssVariables } from '@/lib/brand/jpvDesignSystem'
import '@payloadcms/next/css'
import './jpv-admin.scss'

import importMap from './importMap.js'
import { serverFunction } from './actions'

type Args = {
  children: React.ReactNode
}

export default async function Layout({ children }: Args) {
  return (
    <RootLayout
      config={config}
      htmlProps={{
        className: `${jpvFont.className} ${jpvFont.variable}`,
        style: jpvCssVariables,
      }}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {children}
    </RootLayout>
  )
}
