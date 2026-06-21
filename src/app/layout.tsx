import { ReactNode } from 'react'

// Root layout intentionally has no html/body — each route group provides its own.
// (frontend)/layout.tsx provides html/body for the app.
// (payload)/layout.tsx delegates to Payload's RootLayout which provides its own html/body.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
