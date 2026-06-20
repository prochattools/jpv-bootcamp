import type React from 'react'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import config from '@payload-config'
import '@payloadcms/ui/scss/app.scss'

import importMap from './importMap.js'

type Args = {
  children: React.ReactNode
}

const serverFunction: Parameters<typeof RootLayout>[0]['serverFunction'] = async (args) => {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}

export default async function Layout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  )
}
