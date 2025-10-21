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
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `https://${config.domainName}`;
  const metadataBase = new URL(appUrl.endsWith("/") ? appUrl : `${appUrl}/`);
  const homeUrl = metadataBase.href.replace(/\/$/, "");
  const defaultTitle = `${config.appName} — ${config.appTagline}`;
  const defaultDescription = description || config.appDescription;
  const defaultKeywords =
    keywords || [
      config.appName,
      "Jesus Property Venture",
      "property investing bootcamp",
      "real estate coaching",
      "deal analysis training",
      "property investment community",
    ];

  return {
    // up to 50 characters (what does your app do for the user?) > your main should be here
    title: title || defaultTitle,
    // up to 160 characters (how does your app help the user?)
    description: defaultDescription,
    // some keywords separated by commas. by default it will be your app name
    keywords: defaultKeywords,
    applicationName: config.appName,
    // set a base URL prefix for other fields that require a fully qualified URL (.e.g og:image: og:image: 'https://yourdomain.com/share.png' => '/share.png')
    metadataBase,
    openGraph: {
      title: openGraph?.title || defaultTitle,
      description: openGraph?.description || config.appDescription,
      url: openGraph?.url || homeUrl,
      siteName: (openGraph?.siteName as string) || config.appName,
      images: [
        {
          url: `${homeUrl}/images/jpv-logo.jpg`,
          width: 1200,
          height: 630,
          alt: config.appTagline,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      title: openGraph?.title || defaultTitle,
      description: openGraph?.description || config.appDescription,
      images: [`${homeUrl}/images/jpv-logo.jpg`],
      card: "summary_large_image",
      creator: "@dennis_babych",
    },
    // If a canonical URL is given, we add it. The metadataBase will turn the relative URL into a fully qualified URL
    ...(canonicalUrlRelative && {
      alternates: { canonical: canonicalUrlRelative },
    }),
    // If you want to add extra tags, you can pass them here
    ...extraTags,
  };
};

// Strctured Data for Rich Results on Google. Learn more: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
// Find your type here (SoftwareApp, Book...): https://developers.google.com/search/docs/appearance/structured-data/search-gallery
// Use this tool to check data is well structure: https://search.google.com/test/rich-results
// You don't have to use this component, but it increase your chances of having a rich snippet on Google.
// I recommend this one below to your /page.js for software apps: It tells Google your AppName is a Software, and it has a rating of 4.8/5 from 12 reviews.
// Fill the fields with your own data
// See https://micro.st/docs/features/seo

export const renderSchemaTags = () => {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `https://${config.domainName}`;
  const homeUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  const offerCatalog = {
    "@type": "OfferCatalog",
    name: "JPV Bootcamp Plans",
    itemListElement: [
      {
        "@type": "Offer",
        name: "Starter",
        description: "Get a feel for it",
        price: "0",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
        url: `${homeUrl}/#pricing`,
      },
      {
        "@type": "Offer",
        name: "Pro",
        description: "Everything to get profitable",
        price: "39",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
        url: `${homeUrl}/#pricing`,
      },
      {
        "@type": "Offer",
        name: "VIP",
        description: "Hands-on support",
        price: "149",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
        url: `${homeUrl}/#pricing`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "http://schema.org",
          "@type": "EducationalOrganization",
          name: config.appName,
          alternateName: "JPV Bootcamp",
          slogan: config.appTagline,
          description: config.appDescription,
          image: `${homeUrl}/images/jpv-logo.jpg`,
          url: `${homeUrl}/`,
          logo: `${homeUrl}/images/jpv-logo.jpg`,
          sameAs: [`${homeUrl}/`],
          areaServed: {
            "@type": "Country",
            name: "United Kingdom",
          },
          audience: {
            "@type": "EducationalAudience",
            educationalRole: "Property investor",
            audienceType: "Ambitious investors seeking coaching",
          },
          hasOfferCatalog: offerCatalog,
          offers: offerCatalog.itemListElement,
          potentialAction: {
            "@type": "RegisterAction",
            target: `${homeUrl}/#join`,
            name: "Join the JPV Bootcamp",
            description: config.appPreheader,
          },
        }),
      }}
    ></script>
  );
};
