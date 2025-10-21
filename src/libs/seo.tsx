import type { Metadata } from "next";
import config from "@/config";

// These are all the SEO tags you can add to your pages.
// It prefills data with default title/description/OG, etc.. and you can cusotmize it for each page.
// It's already added in the root layout.js so you don't have to add it to every pages
// But I recommend to set the canonical URL for each page (export const metadata = getSEOTags({canonicalUrlRelative: "/"});)
// See https://micro.st/docs/features/seo

export const getSEOTags = ({
  title,
  description,
  keywords,
  openGraph,
  canonicalUrlRelative,
  extraTags,
}: Metadata & {
  canonicalUrlRelative?: string;
  extraTags?: Record<string, any>;
} = {}) => {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `https://${config.domainName}`;
  const metadataBase = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const canonicalPath = canonicalUrlRelative ?? config.canonicalPath;
  const finalTitle = title || config.siteTitle;
  const finalDescription = description || config.appDescription;
  const finalKeywords =
    keywords || [
      "JPV",
      "Jesus Property Venture",
      "property investing bootcamp",
      "property coaching",
      "real estate investing course",
      "deal analysis training",
      "property investment community",
    ];
  const absoluteCanonical =
    canonicalPath === "/"
      ? `${baseUrl}/`
      : `${baseUrl}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;
  const previewImage = `${baseUrl}${config.socialPreviewImage}`;

  return {
    title: finalTitle,
    description: finalDescription,
    keywords: finalKeywords,
    applicationName: config.appName,
    metadataBase,
    authors: [{ name: config.author }],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: canonicalPath,
    },
    manifest: "/manifest.json",
    icons: {
      icon: "/favicon.png",
    },
    openGraph: {
      title: openGraph?.title || finalTitle,
      description: openGraph?.description || config.ogDescription,
      url: openGraph?.url || absoluteCanonical,
      siteName: (openGraph?.siteName as string) || config.appName,
      images: [
        {
          url: previewImage,
          width: 1200,
          height: 630,
          alt: config.appTagline,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: config.twitterDescription,
      images: [previewImage],
    },
    ...extraTags,
  };
};

export const renderSchemaTags = () => {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `https://${config.domainName}`;
  const homeUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const logoUrl = `${baseUrl}${config.organizationLogo}`;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: config.appName,
          url: homeUrl,
          logo: logoUrl,
          sameAs: config.organizationSameAs,
        }),
      }}
    ></script>
  );
};
