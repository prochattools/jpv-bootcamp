// tailwind.config.ts

import type { Config } from "tailwindcss";
import { jpvDesignTokens } from "./src/lib/brand/jpvDesignSystem";

const config = {
  // Dark utilities are reserved for the authenticated member portal. The
  // public site, auth screens, and Payload admin remain light-only even when
  // navigation happens after a portal session.
  darkMode: ["class", ".jpv-portal-theme-root.dark"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./views/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx,scss,css}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Existing colors
        primary: "var(--jpv-brand)",
        black: "var(--jpv-ink)",
        white: "var(--jpv-canvas)",
        black1: "var(--jpv-ink)",
        secondary: "var(--jpv-border)",
        neutral: {
          50: "var(--jpv-canvas)",
          100: "var(--jpv-surface)",
          200: "var(--jpv-border)",
          300: "color-mix(in srgb, var(--jpv-border) 75%, var(--jpv-muted))",
          400: "color-mix(in srgb, var(--jpv-border) 42%, var(--jpv-muted))",
          500: "var(--jpv-muted)",
          600: "color-mix(in srgb, var(--jpv-muted) 76%, var(--jpv-ink))",
          700: "color-mix(in srgb, var(--jpv-muted) 45%, var(--jpv-ink))",
          800: "var(--jpv-brand-deep)",
          900: "var(--jpv-ink)",
          950: "var(--jpv-ink)",
        },
        emerald: {
          50: "color-mix(in srgb, var(--jpv-brand) 8%, var(--jpv-canvas))",
          100: "color-mix(in srgb, var(--jpv-brand) 14%, var(--jpv-canvas))",
          200: "color-mix(in srgb, var(--jpv-brand) 30%, var(--jpv-border))",
          700: "var(--jpv-brand-deep)",
          800: "var(--jpv-brand-deep)",
        },
        red: {
          50: "color-mix(in srgb, var(--jpv-danger) 8%, var(--jpv-canvas))",
          100: "color-mix(in srgb, var(--jpv-danger) 14%, var(--jpv-canvas))",
          200: "color-mix(in srgb, var(--jpv-danger) 32%, var(--jpv-border))",
          700: "color-mix(in srgb, var(--jpv-danger) 82%, var(--jpv-ink))",
          800: "color-mix(in srgb, var(--jpv-danger) 72%, var(--jpv-ink))",
        },
        orange: {
          50: "color-mix(in srgb, var(--jpv-sunshine) 14%, var(--jpv-canvas))",
          200: "color-mix(in srgb, var(--jpv-sunshine) 42%, var(--jpv-border))",
          300: "color-mix(in srgb, var(--jpv-sunshine) 64%, var(--jpv-border))",
          950: "var(--jpv-ink)",
        },

        // JPV colors
        jpv: {
          canvas: "var(--jpv-canvas)",
          surface: "var(--jpv-surface)",
          "surface-strong": "var(--jpv-surface-strong)",
          ink: "var(--jpv-ink)",
          muted: "var(--jpv-muted)",
          border: "var(--jpv-border)",
          focus: "var(--jpv-focus)",
          sunshine: "var(--jpv-sunshine)",
          "sunshine-ink": "var(--jpv-sunshine-ink)",
          danger: "var(--jpv-danger)",
          "danger-surface": "var(--jpv-danger-surface)",
          "danger-ink": "var(--jpv-danger-ink)",
          "inverse-muted": "var(--jpv-inverse-muted)",
          // Canonical brand aliases — jpv-brand, jpv-brand-deep, jpv-brand-hover, jpv-brand-bright
          brand: {
            DEFAULT: "var(--jpv-brand)",
            deep: "var(--jpv-brand-deep)",
            hover: "var(--jpv-brand-hover)",
            bright: "var(--jpv-brand-bright)",
          },
          bg: {
            DEFAULT: "var(--jpv-brand-deep)",
            dark: "var(--jpv-ink)",
            light: "var(--jpv-surface-strong)",
          },
          green: {
            DEFAULT: "var(--jpv-brand)",
            hover: "var(--jpv-brand-hover)",
            deep: "var(--jpv-brand-deep)",
            soft: "color-mix(in srgb, var(--jpv-brand-bright) 25%, transparent)",
          },
          gray: {
            50: "var(--jpv-canvas)",
            200: "var(--jpv-border)",
            400: "var(--jpv-muted)",
            700: "var(--jpv-brand-deep)",
            900: "var(--jpv-ink)",
          },
        },
      },
      backgroundImage: {
        // Existing background
        banner: "url('/assets/banner.svg')",

        // JPV background
        "jpv-gradient": "linear-gradient(to bottom, var(--jpv-brand-deep), var(--jpv-ink))",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },

      // JPV extras
      boxShadow: {
        "jpv-glow": "var(--jpv-shadow)",
        "jpv-card": "var(--jpv-shadow)",
        "jpv-panel": "var(--jpv-shadow)",
        "jpv-floating": "var(--jpv-shadow-floating)",
      },
      fontFamily: {
        sans: ["var(--font-jpv)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: jpvDesignTokens.radius.detail,
        DEFAULT: jpvDesignTokens.radius.control,
        md: jpvDesignTokens.radius.control,
        lg: jpvDesignTokens.radius.control,
        xl: jpvDesignTokens.radius.card,
        "2xl": jpvDesignTokens.radius.panel,
        "3xl": jpvDesignTokens.radius.panel,
        full: jpvDesignTokens.radius.pill,
        "jpv-control": jpvDesignTokens.radius.control,
        "jpv-action": jpvDesignTokens.radius.action,
        "jpv-card": jpvDesignTokens.radius.card,
        "jpv-panel": jpvDesignTokens.radius.panel,
        "jpv-pill": jpvDesignTokens.radius.pill,
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
