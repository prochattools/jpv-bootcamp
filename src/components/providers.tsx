'use client';

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </ThemeProvider>

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
