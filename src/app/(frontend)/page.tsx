"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import SponsoredPayItForward from "@/components/sponsored-pay-it-forward";

export default function HomePage() {
  const signInHref = "https://portal.jpvbootcamp.com/community/?fcom_action=auth";
  const signUpHref = "https://portal.jpvbootcamp.com/community?fcom_action=auth&form=register";
  const portalUpgradeUrl = process.env.NEXT_PUBLIC_PORTAL_UPGRADE_URL;
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportQuestion, setSupportQuestion] = useState("");
  const [supportStatus, setSupportStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [supportError, setSupportError] = useState<string | null>(null);
  const isSupportSending = supportStatus === "sending";
  const navLinks = [
    { label: "Curriculum", href: "#curriculum" },
    { label: "Community", href: "#community" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Events", href: "https://ibbootcamp.co.uk/" },
  ];
  const heroNotices = [
    {
      title: "Next Online Training",
      meta: (
        <>
          Friday, 24 April, 7 pm · <a href="#pricing-pro" className="hover:text-white transition-colors underline decoration-jpv-green/40 underline-offset-4">Monthly</a> and <a href="#pricing-vip" className="hover:text-white transition-colors underline decoration-jpv-green/40 underline-offset-4">Annually</a>
        </>
      ),
      description: (
        <>
          Weekly online training for 5 weeks for <a href="#pricing-pro" className="hover:text-white hover:underline transition-colors">Monthly</a> and 1 additional in-person live session for <a href="#pricing-vip" className="hover:text-white hover:underline transition-colors">Annually</a>.
        </>
      ),
    },
    {
      title: "Inheritance Builders Bootcamp Conference",
      meta: "27 March 2026 · London",
      description:
        "A flagship Christian business event for believers growing in biblical stewardship and Kingdom impact through wise investment.",
      href: "https://ibbootcamp.co.uk",
      target: "_blank",
      rel: "nofollow noopener noreferrer",
    },
  ];
  const learnSections = [
    {
      title: "Foundations",
      points: ["Strategy selection", "Market and area analysis", "Team and power circle"],
    },
    {
      title: "Numbers that matter",
      points: ["Yield vs ROI", "BRRR and flips", "Risk management"],
    },
    {
      title: "Doing deals",
      points: ["Sourcing and negotiation", "Funding options", "Refurbs and lettings"],
    },
  ];
  const communityMessages = [
    { author: "Amelia", content: "Would you do BRRR on a 3-bed terrace in Leeds? Numbers in thread." },
    { author: "Coach", content: "Post the ARV and refurb budget. Quick rule: 75% ARV − costs = max offer." },
    { author: "Noah", content: "Used buy-to-let calc → ROI 17.8% assuming 5.5% interest-only." },
    { author: "Amelia", content: "ARV £195k, refurb £22k, rent est £1,050. Thoughts on lenders?" },
  ];
  const faqItems = [
    {
      question: "How do payments work?",
      answer: "We accept debit/credit via Stripe. Subscriptions renew monthly; cancel any time from your account.",
    },
    {
      question: "Do you provide certificates?",
      answer:
        "Yes—complete the core modules and quizzes to earn a completion certificate you can add to LinkedIn.",
    },
    {
      question: "Is there support for beginners?",
      answer: "Absolutely—start with the foundations track and join the weekly newcomer clinic.",
    },
    {
      question: "Can I upgrade later?",
      answer: "Upgrades pro-rate instantly; your remaining balance is credited automatically.",
    },
  ];
  const pricingPlans: Array<{
    name: string;
    price: string;
    description: string;
    features: string[];
    ctaLabel: string;
    ctaHref: string;
    ctaTarget?: string;
    ctaRel?: string;
    highlight: boolean;
    badge?: string;
    subcopy?: string;
    disabled?: boolean;
  }> = [
    {
      name: "Monthly",
      price: "£80/mo",
      description: "Everything to get profitable",
      features: ["Full course library", "Live Zoom training", "Deal analysis templates", "Active community access"],
      ctaLabel: "Start Membership",
      ctaHref: "/api/stripe/checkout?priceId=price_1TwKXkLQNsjxBhGBB48pVZa6",
      highlight: true,
      badge: "Most popular",
      subcopy: "14-day money-back guarantee",
    },
    {
      name: "Annually",
      price: "£800 annually",
      description: "Hands-on support",
      features: ["All Pro features", "Weekly group coaching", "1:1 deal review (when needed)", "Live Event"],
      ctaLabel: "Available Zoom",
      ctaHref: "#",
      highlight: false,
      disabled: true,
    },
  ];
  const onboardingSteps = [
    {
      title: "Create your account",
      description: "Sign up, confirm your email, and unlock the member dashboard.",
    },
    {
      title: "Set your strategy",
      description: "Pick your path and get a starter plan tailored to your goals.",
    },
    {
      title: "Join the community",
      description: "Introduce yourself, join a channel, and start sharing your first deal.",
    },
  ];
  const handleSupportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (supportStatus === "sending") {
      return;
    }

    setSupportStatus("sending");
    setSupportError(null);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: supportName.trim(),
          email: supportEmail.trim(),
          question: supportQuestion.trim(),
          source: "jpvbootcamp.com footer support modal",
          page: window.location.pathname || "/",
        }),
      });

      type SupportResponse = { ok?: boolean; error?: string };
      let payload: SupportResponse | null = null;

      try {
        payload = (await response.json()) as SupportResponse;
      } catch {
        payload = null;
      }

      if (response.ok && payload?.ok) {
        setSupportStatus("success");
        setSupportName("");
        setSupportEmail("");
        setSupportQuestion("");
      } else {
        setSupportStatus("error");
        setSupportError(payload?.error || "Unable to send your request. Please try again.");
      }
    } catch (error) {
      console.error("Support request failed:", error);
      setSupportStatus("error");
      setSupportError("Unable to send your request. Please try again.");
    }
  };

  const handleSupportCancel = () => {
    const shouldClose = window.confirm(
      "Are you sure you want to cancel? You will lose the message you have written."
    );

    if (!shouldClose) {
      return;
    }

    setIsSupportOpen(false);
    setSupportName("");
    setSupportEmail("");
    setSupportQuestion("");
    setSupportStatus("idle");
    setSupportError(null);
  };

  const handleHowItWorksClose = () => {
    setIsHowItWorksOpen(false);
  };
  return (
    <main className="relative bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <header className="fixed inset-x-0 top-0 z-50 bg-black/80 backdrop-blur border-b border-jpv-gray-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="h-[72px] w-[72px] overflow-hidden rounded-xl">
              <Image
                src="/images/jpv-logo.jpg"
                alt="JPV • Jesus Property Venture logo"
                width={72}
                height={72}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="leading-tight">
              <span className="block text-2xl font-semibold tracking-tight text-white">
                JPV
              </span>
              <span className="block text-base font-medium text-jpv-green">Our passion is people</span>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-8 text-sm text-jpv-gray-200">
            {navLinks.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-jpv-green">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <a
              href={signInHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-jpv-gray-700 px-5 py-2 text-sm text-jpv-gray-200 transition hover:bg-jpv-bg-light hover:text-white"
            >
              Sign in
            </a>
            <a
              href="#pricing"
              className="rounded-full bg-jpv-green px-5 py-2 text-sm font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Join
            </a>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
            className="inline-flex items-center justify-center rounded-full border border-jpv-gray-700 p-2 text-jpv-gray-200 transition hover:border-jpv-green hover:text-jpv-green lg:hidden"
          >
            <span className="sr-only">{isMobileNavOpen ? "Close navigation" : "Open navigation"}</span>
            {isMobileNavOpen ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>
      {isMobileNavOpen && (
        <div className="fixed inset-x-0 top-[112px] z-40 bg-black/95 backdrop-blur-md border-b border-jpv-gray-700/40 lg:hidden animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col px-6 py-4 gap-0 max-w-7xl mx-auto">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileNavOpen(false)}
                className="py-3.5 text-base text-jpv-gray-200 transition hover:text-jpv-green border-b border-jpv-gray-700/30 last:border-0"
              >
                {item.label}
              </a>
            ))}
            <div className="flex gap-3 pt-4 pb-2">
              <a
                href={signInHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex-1 text-center rounded-full border border-jpv-gray-700 px-5 py-2.5 text-sm text-jpv-gray-200 transition hover:bg-jpv-bg-light hover:text-white"
              >
                Sign in
              </a>
              <a
                href="#pricing"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex-1 text-center rounded-full bg-jpv-green px-5 py-2.5 text-sm font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
              >
                Join
              </a>
            </div>
          </nav>
        </div>
      )}
      <section className="min-h-[100dvh] flex flex-col items-center justify-start lg:justify-center px-6 pt-28 pb-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">Property mastery starts here</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Train for Property Success with JPV
              <span className="mt-3 block text-lg font-semibold text-jpv-green sm:text-xl">
                Empowering Christians through property training to steward wealth with faith and purpose
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 sm:text-lg">
              Learn a proven deal-making framework with coaching, tools, and a community built for ambitious property investors.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#pricing"
              className="rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Start learning
            </a>
            <a
              href="#curriculum"
              className="rounded-full border border-jpv-gray-700 px-10 py-3 text-base font-medium text-white transition hover:bg-jpv-bg-light"
            >
              See curriculum
            </a>
          </div>
          <p className="text-sm text-jpv-gray-400 sm:text-base">14-day money-back guarantee · Cancel anytime</p>
          <div className="w-full max-w-4xl">
            <div className="grid gap-4 text-left sm:grid-cols-2">
              {heroNotices.map((notice) => {
                const content = (
                  <>
                    <div className="text-lg font-bold text-white uppercase tracking-wide">{notice.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2rem] text-jpv-green/80">
                      {notice.meta}
                    </div>
                    <p className="mt-2 text-sm text-jpv-gray-400">{notice.description}</p>
                  </>
                );

                const cardClassName =
                  "relative flex h-full flex-col rounded-2xl border border-jpv-green/60 bg-jpv-bg-dark/40 p-4 text-sm text-jpv-gray-300 shadow-jpv-card backdrop-blur before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:border before:border-jpv-green/90 before:opacity-100 before:animate-pulse";

                if (notice.href) {
                  return (
                    <a
                      key={notice.title}
                      href={notice.href}
                      target={notice.target}
                      rel={notice.rel}
                      className={`${cardClassName} cursor-pointer transition hover:border-jpv-green`}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div key={notice.title} className={cardClassName}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <section id="curriculum" className="scroll-mt-28 px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">What you&rsquo;ll learn</h2>
            <p className="mt-4 text-base text-jpv-gray-400 md:text-lg">
              A practical pathway from first deal to scaling a portfolio.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {learnSections.map((section) => (
              <div
                key={section.title}
                className="flex h-full flex-col gap-6 rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur"
              >
                <div>
                  <h3 className="text-xl font-semibold text-jpv-green">{section.title}</h3>
                </div>
                <ul className="space-y-3 text-sm text-jpv-gray-200">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-jpv-green/70 shadow-jpv-glow" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        id="community"
        className="scroll-mt-28 relative border-y border-jpv-gray-700/40 bg-jpv-bg-dark/70 px-6 py-24 sm:py-28"
      >
        <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-jpv-green/5 blur-3xl" />
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-6">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">Community</p>
            <h2 className="text-3xl font-semibold md:text-4xl">Members-only community</h2>
            <div className="space-y-4 text-base text-jpv-gray-400 md:text-lg">
              <p>
                Ask questions, share deals, and get feedback from peers and mentors. Channels for sourcing, analysis, renovations, lettings, and more.
              </p>
              <ul className="space-y-2 text-sm text-jpv-gray-300 md:text-base">
                <li className="flex items-center gap-2">
                  <span className="text-jpv-green">•</span>
                  <span>Accountability squads</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-jpv-green">•</span>
                  <span>Monthly deal review live call</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-jpv-green">•</span>
                  <span>Local meetups calendar</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
              >
                Unlock access
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsHowItWorksOpen(true);
                  setIsSupportOpen(false);
                }}
                className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-10 py-3 text-base font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
              >
                How it works
              </button>
            </div>
          </div>
          <div className="w-full max-w-md rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-light/70 p-8 shadow-jpv-card backdrop-blur">
            <div className="mb-6 flex items-center justify-between text-sm text-jpv-gray-400">
              <span>#deal-analysis</span>
              <span>Demo</span>
            </div>
            <div className="space-y-5 text-sm text-jpv-gray-200">
              {communityMessages.map((message) => {
                const initial = message.author.charAt(0).toUpperCase();
                return (
                  <div
                    key={message.author + message.content}
                    className="flex items-start gap-3 rounded-2xl bg-jpv-bg-dark/70 p-4"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jpv-green/20 text-sm font-semibold text-jpv-green">
                      {initial}
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-jpv-green/90">
                        {message.author}
                      </p>
                      <p className="text-sm text-jpv-gray-200">{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-full border border-jpv-gray-700/60 bg-jpv-bg-dark/80 px-4 py-2">
              <input
                type="text"
                placeholder="Write a message..."
                className="w-full bg-transparent text-sm text-jpv-gray-200 placeholder:text-jpv-gray-400 focus:outline-none"
              />
              <button
                type="button"
                className="rounded-full bg-jpv-green px-4 py-1.5 text-xs font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </section>
      <section id="pricing" className="scroll-mt-28 px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12 text-center md:text-left">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Simple pricing</h2>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 md:text-lg">
              Choose a plan, cancel anytime.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`flex h-full flex-col justify-between rounded-3xl border p-8 shadow-jpv-card backdrop-blur scroll-mt-32 ${plan.highlight
                  ? "border-jpv-green/60 bg-jpv-bg-light/80"
                  : "border-jpv-gray-700/50 bg-jpv-bg-dark/60"
                  }`}
                id={plan.name === "Monthly" ? "pricing-pro" : plan.name === "Annually" ? "pricing-vip" : undefined}
              >
                <div className="space-y-6">
                  <div className="space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-jpv-gray-400">
                          {plan.name}
                        </p>
                        <div className="mt-2 text-3xl font-semibold text-white md:text-4xl">{plan.price}</div>
                      </div>
                      {plan.badge ? (
                        <span className="rounded-full bg-jpv-green px-3 py-1 text-xs font-semibold text-black">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-jpv-gray-400">{plan.description}</p>
                  </div>
                  <ul className="space-y-2 text-left text-sm text-jpv-gray-200">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span className="text-jpv-green">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8 space-y-3 text-left">
                  {plan.disabled ? (
                    <button
                      disabled
                      className="inline-flex w-full items-center justify-center rounded-full border border-jpv-gray-600 px-6 py-3 text-sm font-semibold text-jpv-gray-400 bg-jpv-gray-800/30 cursor-not-allowed opacity-50"
                    >
                      {plan.ctaLabel}
                    </button>
                  ) : (
                    <a
                      href={plan.ctaHref}
                      {...(plan.ctaTarget && { target: plan.ctaTarget })}
                      {...(plan.ctaRel && { rel: plan.ctaRel })}
                      className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition ${plan.highlight
                        ? "bg-jpv-green text-black shadow-jpv-glow hover:bg-jpv-green-hover"
                        : "border border-jpv-gray-600 text-jpv-gray-200 hover:border-jpv-green hover:text-white"
                        }`}
                    >
                      {plan.ctaLabel}
                    </a>
                  )}
                  {plan.subcopy ? <p className="text-xs text-jpv-green/80">{plan.subcopy}</p> : null}
                  {plan.name === "Annually" && portalUpgradeUrl ? (
                    <a
                      href={portalUpgradeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-center text-sm text-white/60 hover:text-white/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green/60 rounded"
                      aria-label="Already a member? Upgrade in portal"
                    >
                      Already a member? Upgrade in portal
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-jpv-gray-400">
            Need invoicing for teams? Contact us for group pricing.
          </p>
          <div className="pt-6">
            <SponsoredPayItForward />
          </div>
        </div>
      </section>
      <section id="faq" className="scroll-mt-28 px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="space-y-3 text-center md:text-left">
            <h2 className="text-3xl font-semibold md:text-4xl">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 px-5 py-4 shadow-jpv-card backdrop-blur"
              >
                <summary className="flex cursor-pointer list-none items-center text-left text-base font-semibold text-white before:mr-3 before:text-sm before:text-jpv-green before:transition before:content-['▸'] group-open:before:content-['▾']">
                  {item.question}
                </summary>
                <p className="mt-4 text-sm text-jpv-gray-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-jpv-gray-700/40 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-jpv-gray-500 sm:flex-row">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <div className="h-14 w-14 overflow-hidden rounded-xl">
              <Image
                src="/images/jpv-logo.jpg"
                alt="JPV • Jesus Property Venture logo"
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            </div>
            <span>
              © {new Date().getFullYear()} JPV. All rights reserved. Powered by{" "}
              <a
                href="https://prochat.tools"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="no-underline transition hover:no-underline hover:font-bold hover:text-jpv-green-hover focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green/60 focus-visible:ring-offset-2 focus-visible:ring-offset-jpv-bg-dark"
              >
                ProChat
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/terms" className="transition hover:text-jpv-green">
              Terms
            </a>
            <a href="/privacy" className="transition hover:text-jpv-green">
              Privacy
            </a>
            <a href="/cookies" className="transition hover:text-jpv-green">
              Cookies
            </a>
            <button
              type="button"
              onClick={() => {
                setIsSupportOpen(true);
                setIsHowItWorksOpen(false);
                setSupportStatus("idle");
                setSupportError(null);
              }}
              className="transition hover:text-jpv-green"
            >
              Support
            </button>
          </div>
        </div>
      </footer>
      {isHowItWorksOpen ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 px-6 py-10 backdrop-blur-sm animate-[modal-fade_0.35s_ease-out]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-it-works-title"
            aria-describedby="how-it-works-desc"
            className="w-full max-w-xl rounded-3xl border border-jpv-gray-700/60 bg-jpv-bg-dark/90 p-6 shadow-jpv-card backdrop-blur animate-[modal-rise_0.35s_ease-out]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="how-it-works-title" className="text-xl font-semibold text-white">
                  How onboarding works
                </h3>
                <p id="how-it-works-desc" className="mt-1 text-sm text-jpv-gray-400">
                  A quick overview of the first steps once you join.
                </p>
              </div>
              <button
                type="button"
                onClick={handleHowItWorksClose}
                className="rounded-full border border-jpv-gray-700/60 p-2 text-jpv-gray-200 transition hover:border-jpv-green hover:text-jpv-green"
                aria-label="Close onboarding steps"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                  <path
                    d="M7 7l10 10M17 7L7 17"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {onboardingSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-4"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jpv-green/20 text-sm font-semibold text-jpv-green">
                      {index + 1}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="text-sm text-jpv-gray-400">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={handleHowItWorksClose}
                className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-6 py-3 text-sm font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isSupportOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6 py-10 backdrop-blur-sm animate-[modal-fade_0.35s_ease-out]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-title"
            aria-describedby="support-desc"
            className="w-full max-w-xl rounded-3xl border border-jpv-gray-700/60 bg-jpv-bg-dark/90 p-6 shadow-jpv-card backdrop-blur animate-[modal-rise_0.35s_ease-out]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="support-title" className="text-xl font-semibold text-white">
                  Support
                </h3>
                <p id="support-desc" className="mt-1 text-sm text-jpv-gray-400">
                  Share your question and we will get back to you shortly.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSupportCancel}
                className="rounded-full border border-jpv-gray-700/60 p-2 text-jpv-gray-200 transition hover:border-jpv-green hover:text-jpv-green"
                aria-label="Close support form"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                  <path
                    d="M7 7l10 10M17 7L7 17"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {supportStatus !== "idle" ? (
              <div className="mt-4 space-y-2 text-sm">
                {supportStatus === "success" ? (
                  <p className="text-jpv-green">Thanks! We&rsquo;ll reply shortly.</p>
                ) : null}
                {supportStatus === "error" && supportError ? (
                  <p className="text-red-400">{supportError}</p>
                ) : null}
                {supportStatus === "sending" ? (
                  <p className="text-jpv-gray-400">Sending your request...</p>
                ) : null}
              </div>
            ) : null}
            <form onSubmit={handleSupportSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label htmlFor="support-name" className="text-sm font-medium text-jpv-gray-200">
                  Name
                </label>
                <input
                  id="support-name"
                  type="text"
                  value={supportName}
                  onChange={(event) => {
                    if (supportStatus !== "idle") {
                      setSupportStatus("idle");
                      setSupportError(null);
                    }
                    setSupportName(event.target.value);
                  }}
                  placeholder="Your name"
                  className="w-full rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 px-4 py-3 text-sm text-jpv-gray-100 placeholder:text-jpv-gray-500 focus:border-jpv-green focus:outline-none focus:ring-2 focus:ring-jpv-green/30"
                  disabled={isSupportSending}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="support-email" className="text-sm font-medium text-jpv-gray-200">
                  Email address
                </label>
                <input
                  id="support-email"
                  type="email"
                  value={supportEmail}
                  onChange={(event) => {
                    if (supportStatus !== "idle") {
                      setSupportStatus("idle");
                      setSupportError(null);
                    }
                    setSupportEmail(event.target.value);
                  }}
                  placeholder="you@email.com"
                  className="w-full rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 px-4 py-3 text-sm text-jpv-gray-100 placeholder:text-jpv-gray-500 focus:border-jpv-green focus:outline-none focus:ring-2 focus:ring-jpv-green/30"
                  disabled={isSupportSending}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="support-question" className="text-sm font-medium text-jpv-gray-200">
                  Question
                </label>
                <textarea
                  id="support-question"
                  value={supportQuestion}
                  onChange={(event) => {
                    if (supportStatus !== "idle") {
                      setSupportStatus("idle");
                      setSupportError(null);
                    }
                    setSupportQuestion(event.target.value);
                  }}
                  placeholder="How can we help?"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 px-4 py-3 text-sm text-jpv-gray-100 placeholder:text-jpv-gray-500 focus:border-jpv-green focus:outline-none focus:ring-2 focus:ring-jpv-green/30"
                  disabled={isSupportSending}
                  required
                />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleSupportCancel}
                  className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-6 py-3 text-sm font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSupportSending}
                  className={`inline-flex items-center justify-center rounded-full bg-jpv-green px-6 py-3 text-sm font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover ${isSupportSending ? "cursor-not-allowed opacity-70 hover:bg-jpv-green" : ""
                    }`}
                >
                  {isSupportSending ? "Sending..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
