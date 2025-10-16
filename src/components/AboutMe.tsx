"use client";
import Image from "next/image";
import { LazyLoadIframe } from "@/components";
import { Telegram, Twitter, Youtube } from "@/icons";
import Link from "next/link";
import AboutBg from "@/assets/images/about-me-bg1.svg";
import AboutBgDark from "@/assets/images/about-me-bg2.svg";
import DennisImg from "@/assets/images/dennis1.svg";
import DennisImgDark from "@/assets/images/dennis2.svg";
import LiveDemoImg from "@/assets/images/live-demo1.svg";
import LiveDemoImgDark from "@/assets/images/live-demo2.svg";

const data = [
  {
    text: "27396 people trust me on",
    link: "https://www.google.com",
    icon: <Youtube />,
  },
  {
    text: "2371 on",
    link: "https://www.google.com",
    icon: <Telegram />,
  },
  {
    text: "and 400 on",
    link: "https://www.google.com",
    icon: <Twitter />,
  },
];

const AboutMe = () => {
  return (
    <div>
      <div className="relative flex justify-center items-center w-full pt-16">
        <Image
          src={AboutBg}
          alt="background"
          fill
          style={{ objectFit: "cover" }}
          className="z-0 block dark:hidden"
        />
        <Image
          src={AboutBgDark}
          alt="background"
          fill
          style={{ objectFit: "cover" }}
          className="z-0 hidden dark:block"
        />
        <div className="relative z-10 max-w-[1440px] w-full px-4 sm:px-12 mb-8">
          <h2 className="text-[32px] sm:text-[42px] leading-[38px] sm:leading-[50px] font-bold text-center text-black1 dark:text-white">
            About Me
          </h2>
          <div className="flex flex-col lg:flex-row justify-between gap-4 mt-10">
            <div className="min-h-full flex flex-col items-center lg:items-stretch lg:flex-row gap-8 lg:w-[30%] justify-end">
              <div>
                <Image
                  src={DennisImg}
                  alt="logo"
                  width={300}
                  height={400}
                  className="block dark:hidden"
                />
                <Image
                  src={DennisImgDark}
                  alt="logo"
                  width={300}
                  height={400}
                  className="hidden dark:block"
                />
              </div>
            </div>
            <div className="lg:w-[65%] text-[#41444C] dark:text-[#B2B5BA] text-base font-medium">
              <p className="mb-3">
                In 2017, I spent two years building a startup, raising funds,
                and investing{" "}
                <strong className="text-black1 dark:text-white">
                  $180,000
                </strong>{" "}
                into it, only to end up with 1 user, $800, and bankruptcy.
              </p>
              <p className="mb-3">
                After that, I built over{" "}
                <strong className="text-black1 dark:text-white">
                  56 different SaaS products
                </strong>{" "}
                for my clients as a developer, and I realized that the clients
                who don’t rely on just one idea but{" "}
                <strong className="text-black1 dark:text-white">
                  test multiple things with the same code
                </strong>{" "}
                are the ones who end up getting{" "}
                <strong className="text-black1 dark:text-white">
                  customers, profits, and exits.
                </strong>
              </p>
              <p className="mb-3">
                Their exits drive me crazy –{" "}
                <strong className="text-black1 dark:text-white">
                  $20M, $5M, $10M,
                </strong>{" "}
                and so on.{" "}
                <strong className="text-black1 dark:text-white">
                  I want that too!
                </strong>
              </p>
              <p className="mb-3">
                That’s why I took my{" "}
                <strong className="text-black1 dark:text-white">
                  10+ years of IT experience
                </strong>{" "}
                and created the{" "}
                <strong className="text-black1 dark:text-white">
                  MicroSaaSFast
                </strong>{" "}
                boilerplate for my own needs, so I can quickly launch my ideas
                and test, test, test. Why? Because by doing this, I can:
              </p>
              <ol className="list-decimal marker:font-bold marker:text-black1 dark:marker:text-white ml-4 sm:ml-0">
                <li className="mb-3">
                  <strong className="text-black1 dark:text-white">
                    Save time and money
                  </strong>{" "}
                  with every launch, and focus on my users and delivering{" "}
                  <strong className="text-black1 dark:text-white">
                    VALUE.
                  </strong>
                </li>
                <li className="mb-3">
                  <strong className="text-black1 dark:text-white">
                    Avoid repetitive tasks
                  </strong>{" "}
                  – Email setup, landing pages, database, SEO, etc.{" "}
                  <strong className="text-black1 dark:text-white">
                    No more coding headaches.
                  </strong>
                </li>
                <li className="mb-3">
                  <strong className="text-black1 dark:text-white">
                    Get profits faster.
                  </strong>{" "}
                  The more ideas you launch, the more you learn, and that
                  knowledge gets you closer to{" "}
                  <strong className="text-black1 dark:text-white">
                    profits, happy users, and exits.
                  </strong>
                </li>
              </ol>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row mt-8 lg:mt-0">
            <div className="lg:-mt-[80px] flex justify-center lg:justify-end order-last lg:order-first">
              <div className="block dark:hidden">
                <Image
                  src={LiveDemoImg}
                  loading="lazy"
                  alt="demo"
                  width={80}
                  height={100}
                  className="mx-auto"
                />
              </div>
              <div className="hidden dark:block">
                <Image
                  src={LiveDemoImgDark}
                  loading="lazy"
                  alt="demo"
                  width={80}
                  height={100}
                  className="mx-auto"
                />
              </div>
            </div>
            <div className="flex flex-col justify-center w-full">
              <p className="text-center text-[#41444C] dark:text-[#B2B5BA]">
                I hate routine, but{" "}
                <strong className="text-black1 dark:text-white">
                  I love making money fast
                </strong>
                , and I’m excited to give you this tool so you can do the same!
              </p>
              <div className="flex lg:items-center justify-center mt-3 gap-4 flex-col md:flex-row">
                {data.map((item, index) => (
                  <Link
                    key={index}
                    href={item?.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-black1 dark:text-white font-semibold text-base"
                  >
                    <span>{item?.text}</span>
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
      <div className="flex justify-center w-full px-4 sm:px-12 mb-16">
        <LazyLoadIframe
          src="https://www.youtube.com/embed/u2eRWwlxHO4?si=EUht9jY10c8tvps5"
          title="No Code SaaS"
        />
      </div>
    </div>
  );
};

export default AboutMe;
