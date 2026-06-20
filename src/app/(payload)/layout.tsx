import type React from 'react'
import { RootLayout } from '@payloadcms/next/layouts'
import config from '@payload-config'
import '@payloadcms/ui/scss/app.scss'

import importMap from './importMap.js'
import { serverFunction } from './actions.js'

type Args = {
  children: React.ReactNode
}

export default async function Layout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  )
}
