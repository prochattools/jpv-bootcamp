import config from '@/config'
import type { Metadata } from 'next'
import { ReactNode } from 'react'

function resolveMetadataBase(): URL {
  const configured =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `https://${config.domainName}`

  try {
    return new URL(configured.endsWith('/') ? configured : `${configured}/`)
  } catch {
    return new URL(`https://${config.domainName}/`)
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
}

// Root layout intentionally has no html/body — each route group provides its own.
// (frontend)/layout.tsx provides html/body for the app.
// (payload)/layout.tsx delegates to Payload's RootLayout which provides its own html/body.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
