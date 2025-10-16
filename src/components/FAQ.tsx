"use client";

import React, { useState, useEffect } from "react";
import { Heading } from "@/components";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const StaticData = {
  title: "A frequently asked questions",
  below_title: "Have another question? Contact me on X or by email",
  faqs: [
    {
      id: 1,
      question: "What do I get?",
      answer: `1. The NextJS starter with all the boilerplate code you need to run a micro SaaS startup fast: a payment system, a database, login, a blog, UI components, and much more.<br />
      The repo is available in:<br />
      - Typescript<br />
      - /app router and /pages router.<br />
      - docker container to launch on any server<br />
      - CMS for Blog and Admin Dashboard<br />
      2. The documentation helps you set up your app from scratch<br />
      3. Access to our Discord with makers & founders who build fast, share their experience, create partnerships for cross promotions and doubling the sales`,
    },
    {
      id: 2,
      question: "What tech stack is included?",
      answer:
        "Next.js 14, TypeScript, Tailwind CSS, Prisma, Supabase, Resend, Radix UI, and more modern tools.",
    },
    {
      id: 3,
      question: "Is it a website template? ",
      answer: `It's more than just a template. You can easily copy and paste website sections, including a pricing section, FAQ, and even a CMS blog. Additionally, you'll have access to a variety of UI components like buttons, modals, and animations. The NextJS starter also includes essential tools for running a micro SaaS business, such as payment processing, email integration, and SEO optimization.`,
    },
    {
      id: 4,
      question: "Why MicroSaaSFast is better than other boilerplates?",
      answer:
        "You are buying not components, you purchasing an experience to ship your micro SaaS fast and make fast money with it.",
    },
    {
      id: 5,
      question: "What are the hosting costs?",
      answer: "Supabase free tier covers most small projects. Resend has generous free limits for email sending.",
    },
    {
      id: 6,
      question: "Can I get a refund?",
      answer:
        "After you purchase a product you will get an immediate access to all materials, so no. But rest assure that average time to launch micro SaaS startup is 7 days and start making money.",
    },
  ],
};

const Faq = ({ data, isHomePage }: any) => {
  const StaticFAQs = StaticData.faqs;
  const faqData = data?.length > 0 ? data : StaticFAQs;

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null; // Avoid rendering until after the initial mount
  }

  return (
    <div className="flex justify-center items-center bg-white dark:bg-[#010814] my-16 w-full">
      <div className="max-w-[1440px] w-full px-4 sm:px-12">
        {isHomePage && (
          <div className="max-w-[624px] mx-auto mb-16">
            <Heading
              title="A Frequently Asked Questions"
              desc="Have another question? Contact me on X or by email"
            />
          </div>
        )}
        <div>
          <Accordion defaultValue={["item-0"]} type="multiple">
            {faqData?.map((item: any, index: number) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="shadow-2xl dark:shadow-none border dark:border-[#373C53] py-2 px-6 rounded-[12px] bg-white dark:bg-gradient-to-r from-[#1E242D] to-[#0B111B] h-full transition-all duration-300 mb-4"
              >
                <AccordionTrigger className="text-start font-semibold text-xl hover:no-underline">
                  {item?.question}
                </AccordionTrigger>
                <AccordionContent className="mt-2">
                  <div className="text-[#010610A6] dark:text-[#808389] font-medium text-base sm:mr-12 mb-4">
                    <div dangerouslySetInnerHTML={{ __html: item?.answer }} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default Faq;
