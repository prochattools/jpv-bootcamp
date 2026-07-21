import { Libre_Baskerville, Outfit, Poppins } from "next/font/google";

export const jpvFont = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jpv",
});

export const landingSerif = Libre_Baskerville({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jpv-landing-serif",
  weight: ["400", "700"],
});

export const landingSans = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jpv-landing-sans",
  weight: ["400", "500", "600"],
});
