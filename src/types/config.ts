export type Theme =
  | "light"
  | "dark"
  | "cupcake"
  | "bumblebee"
  | "emerald"
  | "corporate"
  | "synthwave"
  | "retro"
  | "cyberpunk"
  | "valentine"
  | "halloween"
  | "garden"
  | "forest"
  | "aqua"
  | "lofi"
  | "pastel"
  | "fantasy"
  | "wireframe"
  | "black"
  | "luxury"
  | "dracula"
  | "";

export interface ConfigProps {
  appName: string;
  author: string;
  siteTitle: string;
  appDescription: string;
  appTagline: string;
  appPreheader: string;
  ogDescription: string;
  twitterDescription: string;
  canonicalPath: string;
  socialPreviewImage: string;
  organizationLogo: string;
  organizationSameAs: string[];
  domainName: string;
  colors: {
    theme: Theme;
    main: string;
  };
  resend: {
    fromAdmin: string;
    supportEmail?: string;
    forwardRepliesTo?: string;
    subjects?: {
      [key: string]: string
    }
  };
}
