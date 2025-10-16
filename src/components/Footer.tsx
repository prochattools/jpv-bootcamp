"use client";
import Image from "next/image";
import { Logo } from "@/components";
import Link from "next/link";
import NavLinks from "@/components/nav-links";
import { Telegram, Youtube } from "@/icons";
import footerBg from "@/assets/images/footer-bg1.svg";
import footerBgDark from "@/assets/images/footer-bg2.svg";

const nav_links1 = [
  {
    title: "Demo",
    link: "/",
  },
  {
    title: "Pricing",
    link: "/",
  },
  {
    title: "Support",
    link: "#",
  },
  {
    title: "Documentation",
    link: "https://docs.microsaasfast.me/",
  },
  {
    title: "Affiliates - Earn up to $123 per sale",
    link: "#",
  },
];

const nav_links2 = [
  {
    title: "Terms of services",
    link: "https://elegant-nightshade-79e.notion.site/Terms-Services-4335df481a50486ca26c81e699a2fbf1",
  },
  {
    title: "Privacy Policy",
    link: "https://elegant-nightshade-79e.notion.site/Privacy-policy-f2a3142bfb8c4b16b80369c19263c23a",
  },
  {
    title: "Licences",
    link: "#",
  },
];

const data = [
  {
    link: "https://www.google.com",
    icon: <Youtube />,
  },
  {
    link: "https://www.google.com",
    icon: <Telegram />,
  },
];

const Footer = () => {
  return (
    <div className="relative flex justify-center items-center w-full">
      <Image
        src={footerBg}
        alt="background"
        fill
        style={{ objectFit: "cover" }}
        className="z-0 block dark:hidden"
      />
      <Image
        src={footerBgDark}
        alt="background"
        fill
        style={{ objectFit: "cover" }}
        className="z-0 hidden dark:block"
      />
      <div className="relative z-10 max-w-[1440px] w-full h-full px-4 sm:px-12 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 h-full gap-x-4 gap-y-12">
          <div className="flex flex-col !min-h-[inherit] justify-between gap-8">
            <Link href="/">
              <Logo />
            </Link>
            <div>
              <p className="text-xs text-[#7B7E83] dark:text-[#808389] font-medium">
                Launch your SaaS in days, not weeks
              </p>
              <p className="text-xs text-[#7B7E83] dark:text-[#808389] font-medium">
                Copyright © 2025 - All rights reserved - JCCP Holdings
              </p>
            </div>
          </div>
          <div className="sm:order-3 xl:order-2">
            <p className="uppercase text-[#86898E] dark:text-[#808389] font-semibold text-base mb-8">
              Links
            </p>
            <NavLinks nav_links={nav_links1} isFooter={true} />
          </div>
          <div className="sm:order-last xl:order-3">
            <p className="uppercase text-[#86898E] dark:text-[#808389] font-semibold text-base mb-8">
              Legal
            </p>
            <NavLinks nav_links={nav_links2} isFooter={true} />
          </div>
          <div className="sm:order-2 xl:order-last">
            <p className="uppercase text-[#86898E] dark:text-[#808389] font-semibold text-base mb-8">
              BY THE MICRO SAAS FAST MAKER
            </p>
            <p className="text-black1 dark:text-white font-medium text-base mb-6">
              DennisBabych
            </p>
            <p className="text-black1 dark:text-white font-medium text-base mb-6">
              DesignFast2
            </p>
            <div className="flex items-center gap-4">
              {data.map((item, index) => (
                <Link
                  key={index}
                  href={item?.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="shadow-lg bg-white h-[32px] flex items-center justify-center px-3 rounded-[8px]">
                    {item?.icon}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
