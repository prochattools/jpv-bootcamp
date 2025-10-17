// tailwind.config.ts

import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
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
        primary: "#006FEE",
        black1: "#010610",
        secondary: "#D6D6DE",

        // JPV colors
        jpv: {
          bg: {
            DEFAULT: "#0C0F0D",
            dark: "#131613",
            light: "#1A1C1A",
          },
          green: {
            DEFAULT: "#2DD56E",
            hover: "#3EE37D",
            soft: "rgba(45,213,110,0.25)",
          },
          gray: {
            50: "#F9FAFB",
            200: "#E4E4E7",
            400: "#A1A1AA",
            700: "#3B4D3F",
            900: "#131613",
          },
        },
      },
      backgroundImage: {
        // Existing background
        banner: "url('/assets/banner.svg')",

        // JPV background
        "jpv-gradient": "linear-gradient(to bottom, #0C0F0D, #1A1C1A)",
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
        "jpv-glow": "0 0 15px rgba(45, 213, 110, 0.25)",
        "jpv-card": "0 2px 10px rgba(0,0,0,0.2)",
      },
      fontFamily: {
        // Extends default sans family. Ensure Inter is loaded via CSS or next/font
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
