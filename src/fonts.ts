import { Libre_Baskerville, Poppins } from "next/font/google";

export const jpvFont = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jpv",
  weight: ["400", "500", "600"],
});

export const landingSerif = Libre_Baskerville({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jpv-landing-serif",
  weight: ["400", "700"],
});

export const landingSans = jpvFont;
