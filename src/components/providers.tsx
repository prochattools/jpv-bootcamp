'use client';

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

function PublicThemeReset(): null {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname?.startsWith('/portal')) return

    // The only supported theme outside the member portal is light. Clear a
    // class left behind by the portal provider during client-side navigation.
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
  }, [pathname])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicThemeReset />
      <div className="min-h-screen bg-jpv-canvas text-jpv-ink">
        {children}
      </div>

      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--jpv-ink)',
            border: '1px solid var(--jpv-border)',
            borderRadius: 'var(--jpv-radius-card)',
            boxShadow: 'var(--jpv-shadow-floating)',
            color: 'var(--jpv-canvas)',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: 'var(--jpv-brand)',
              secondary: 'var(--jpv-ink)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--jpv-danger)',
              secondary: 'var(--jpv-canvas)',
            },
          },
        }}
      />
    </>
  );
}
