"use client";

import { ArrowRight, Check, ChevronDown, Menu, X } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

import SponsoredPayItForward from "@/components/sponsored-pay-it-forward";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";
import { landingSans, landingSerif } from "@/fonts";
import { jpvBrand } from "@/lib/brand/jpvDesignSystem";

import styles from "./landing.module.scss";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Community", href: "#community" },
  { label: "Resources", href: "#how-it-works" },
  { label: "Success Stories", href: "#success-stories" },
  { label: "Partners", href: "/partners" },
  { label: "About", href: "#about" },
] as const;

const benefitItems = [
  "Monthly and annual plans",
  "Instant access when you join",
  "Live training",
  "Hands-on approach",
  "Private live events",
  "Clear membership options",
  "Video curriculum",
] as const;

const programmeCards = [
  {
    title: "Structured learning",
    description: "Weekly teaching and protected programme resources.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-20-28-15.jpg",
  },
  {
    title: "Practical application",
    description: "Property scenarios, exercises, and accountable next steps.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg",
  },
  {
    title: "Live experiences",
    description: "In-person events that connect learning with action.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg",
  },
  {
    title: "Community support",
    description: "Shared purpose, practical discussion, and encouragement.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg",
  },
] as const;

const journeyCards = [
  {
    number: "01",
    title: "Learn",
    description:
      "Access structured video lessons, practical templates, and seven weekly Friday Zoom sessions.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-20-28-15.jpg",
    items: [
      "Weekly live online training",
      "Replays available for later review",
      "Interactive questions and answers",
    ],
  },
  {
    number: "02",
    title: "Apply",
    description:
      "Analyse investment opportunities, complete practical exercises, and receive expert feedback.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg",
    items: [
      "Full-day live event",
      "Real property scenarios",
      "Practical expert feedback",
    ],
  },
  {
    number: "03",
    title: "Build",
    description:
      "Move from knowledge to action with support around property, finance, renovation, and adding value.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg",
    items: [
      "Guidance for each next step",
      "Support through practical decisions",
      "A path towards a portfolio",
    ],
  },
  {
    number: "04",
    title: "Belong",
    description:
      "Continue the journey with people committed to excellence, accountability, and shared purpose.",
    image: "/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg",
    items: [
      "Member discussions",
      "Programme questions and answers",
      "Protected resources",
    ],
  },
] as const;

const faqItems = [
  {
    question: "How do payments work?",
    answer:
      "Card payments are processed through Stripe. The available monthly and annual options are shown in the pricing section.",
  },
  {
    question: "What does the JPV Bootcamp Membership include?",
    answer:
      "The JPV Bootcamp Membership provides access to the current programme, protected resources, and community features available in the member portal.",
  },
  {
    question: "Where can I ask a question?",
    answer: "Use the support form at the bottom of this page.",
  },
] as const;

const pricingPlans = [
  {
    name: "Monthly",
    contractLabel: "JPV Bootcamp Membership — Monthly",
    contractPrice: "£80/month",
    price: "£80",
    suffix: "per month",
    description: "No minimum commitment",
    features: [
      "Renews monthly until cancelled",
      "Cancellation takes effect at the end of the paid month",
      "Programme, resources, and community access",
      "Personal voucher and pay-it-forward codes supported",
    ],
    ctaLabel: "Choose monthly membership",
    ctaHref: "/upgrade",
    featured: false,
  },
  {
    name: "Annual",
    contractLabel: "JPV Bootcamp Membership — Annual",
    contractPrice: "£800/year",
    price: "£800",
    suffix: "paid upfront for 12 months",
    description: "Two months included at no extra cost",
    features: [
      "Automatically renews annually unless cancelled",
      "Programme, resources, and community access",
      "Personal voucher and pay-it-forward codes supported",
      "One clear annual payment",
    ],
    ctaLabel: "Choose annual membership",
    ctaHref: "/upgrade",
    featured: true,
  },
] as const;

const onboardingSteps = [
  {
    title: "Choose your membership",
    description:
      "Select monthly or annual billing through the secure membership checkout.",
  },
  {
    title: "Verify your account",
    description:
      "Follow the secure email steps to confirm your address and set your password.",
  },
  {
    title: "Enter the member portal",
    description:
      "Continue into your available programme, resources, community, and billing tools.",
  },
] as const;

const inputClassName =
  "mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink placeholder:text-jpv-muted/70 transition focus:border-jpv-green-deep focus:outline-none focus:ring-2 focus:ring-jpv-green/25 disabled:cursor-not-allowed disabled:opacity-60";

export default function HomePage() {
  const signInHref = "/portal?mode=login";
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportQuestion, setSupportQuestion] = useState("");
  const [supportStatus, setSupportStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [supportError, setSupportError] = useState<string | null>(null);
  const isSupportSending = supportStatus === "sending";

  async function handleSupportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSupportSending) return;

    setSupportStatus("sending");
    setSupportError(null);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supportName.trim(),
          email: supportEmail.trim(),
          question: supportQuestion.trim(),
          source: "jpvbootcamp.com footer support modal",
          page: window.location.pathname || "/",
        }),
      });

      type SupportResponse = { ok?: boolean; accepted?: boolean };
      let payload: SupportResponse | null = null;
      try {
        payload = (await response.json()) as SupportResponse;
      } catch {
        payload = null;
      }

      if (response.ok && payload?.ok && payload.accepted) {
        setSupportStatus("success");
        setSupportName("");
        setSupportEmail("");
        setSupportQuestion("");
      } else {
        setSupportStatus("error");
        setSupportError(
          "We could not save your request. Please try again shortly.",
        );
      }
    } catch {
      setSupportStatus("error");
      setSupportError(
        "We could not save your request. Please try again shortly.",
      );
    }
  }

  function handleSupportCancel() {
    if (
      (supportName || supportEmail || supportQuestion) &&
      !window.confirm(
        "Close the support form and discard what you have written?",
      )
    ) {
      return;
    }

    setIsSupportOpen(false);
    setSupportName("");
    setSupportEmail("");
    setSupportQuestion("");
    setSupportStatus("idle");
    setSupportError(null);
  }

  function openSupportForm() {
    setIsSupportOpen(true);
    setIsHowItWorksOpen(false);
    setSupportStatus("idle");
    setSupportError(null);
  }

  return (
    <main
      className={`${styles.landing} ${landingSerif.variable} ${landingSans.variable}`}
    >
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <a
            aria-label="JPV Bootcamp home"
            className={styles.brand}
            href="#home"
          >
            <Image
              alt="JPV Jesus Property Venture"
              className={styles.brandLogo}
              height={44}
              priority
              src={jpvBrand.logoPath}
              width={44}
            />
            <span className={styles.brandText}>
              <strong>JPV Bootcamp</strong>
              <small>Our passion is people</small>
            </span>
          </a>

          <nav aria-label="Main navigation" className={styles.nav}>
            {navLinks.map((item) => (
              <a href={item.href} key={item.label}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <a className={styles.buttonOutline} href="#support">
              Support
            </a>
            <a className={styles.buttonOutline} href={signInHref}>
              Sign in
            </a>
            <a className={styles.button} href="#pricing">
              Join
            </a>
          </div>

          <button
            aria-controls="mobile-navigation"
            aria-expanded={isMobileNavOpen}
            aria-label={
              isMobileNavOpen ? "Close navigation" : "Open navigation"
            }
            className={styles.menuButton}
            onClick={() => setIsMobileNavOpen((open) => !open)}
            type="button"
          >
            {isMobileNavOpen ? (
              <X aria-hidden="true" size={19} />
            ) : (
              <Menu aria-hidden="true" size={19} />
            )}
          </button>
        </div>

        {isMobileNavOpen ? (
          <nav
            aria-label="Mobile navigation"
            className={styles.mobileNav}
            id="mobile-navigation"
          >
            {navLinks.map((item) => (
              <a
                href={item.href}
                key={item.label}
                onClick={() => setIsMobileNavOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className={styles.mobileActions}>
              <a
                className={styles.buttonOutline}
                href="#support"
                onClick={() => setIsMobileNavOpen(false)}
              >
                Support
              </a>
              <a
                className={styles.buttonOutline}
                href={signInHref}
                onClick={() => setIsMobileNavOpen(false)}
              >
                Sign in
              </a>
              <a
                className={styles.button}
                href="#pricing"
                onClick={() => setIsMobileNavOpen(false)}
              >
                Join
              </a>
            </div>
          </nav>
        ) : null}
      </header>

      <div id="main-content">
        <section className={styles.hero} id="home">
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>
              For those called beyond the ordinary
            </p>
            <h1>Choose purpose over comfort.</h1>
            <p className={styles.heroLead}>
              <strong>
                Transforming Lives. Equipping Purpose. Inspiring Freedom.
              </strong>
              <br />
              Invest wisely, steward faithfully, and bless generously through
              property education shaped by wisdom, strategy, and stewardship.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.button} href="#pricing">
                Become a Member <ArrowRight aria-hidden="true" size={15} />
              </a>
              <button
                className={styles.plainLink}
                onClick={() => setIsHowItWorksOpen(true)}
                type="button"
              >
                See how it works
              </button>
            </div>
            <p className={styles.heroMeta}>
              Plans start at £80 per month, or £800 paid annually.
            </p>
          </div>
        </section>

        <section aria-label="Membership benefits" className={styles.marquee}>
          <div className={styles.marqueeTrack}>
            {[false, true].map((duplicate) => (
              <div
                aria-hidden={duplicate ? "true" : undefined}
                className={styles.marqueeGroup}
                key={duplicate ? "duplicate" : "primary"}
              >
                {benefitItems.map((item) => (
                  <span className={styles.marqueeItem} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.programme}>
          <div className={styles.container}>
            <div className={styles.centredHeading}>
              <p className={styles.eyebrow}>A practical programme</p>
              <h2 className={styles.sectionHeading}>
                Learn deeply. Apply wisely. Build with purpose.
              </h2>
              <p className={styles.sectionIntro}>
                Every part of the programme is designed to connect clear
                teaching with real action and accountable community.
              </p>
            </div>
            <div className={styles.programmeGrid}>
              {programmeCards.map((card) => (
                <a
                  className={styles.programmeCard}
                  href="#how-it-works"
                  key={card.title}
                >
                  <div className={styles.programmeImage}>
                    <Image alt="" height={960} src={card.image} width={720} />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.story} id="who">
          <div className={`${styles.container} ${styles.storyGrid}`}>
            <div className={styles.storyCopy}>
              <p className={styles.eyebrow}>Who is JPV Bootcamp for?</p>
              <h2 className={styles.sectionHeading}>
                Property education for a purpose bigger than personal success.
              </h2>
              <p>
                We are not just another property training organisation whose
                sole aim is to provide knowledge and help people achieve
                financial freedom and build wealth.
              </p>
              <p>
                Our vision goes far beyond personal success. We want to see
                communities built within the Body of Christ, where believers
                support one another and work together on investments and
                transformational projects that benefit families, communities,
                nations, and generations to come.
              </p>
              <p>
                <strong>
                  JPV Bootcamp exists to help believers walk in their calling
                  and become faithful stewards of the resources entrusted to
                  them.
                </strong>
              </p>
            </div>
            <div className={styles.storyMedia}>
              <Image
                alt="A JPV learning event in a historic auditorium"
                height={1200}
                src="/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg"
                width={960}
              />
              <div className={styles.storyNote}>
                <strong>Wisdom becomes action.</strong>
                <span>
                  Teaching, practical experience, and shared purpose stay
                  connected.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.journey} id="how-it-works">
          <div className={styles.container}>
            <div className={styles.journeyIntro}>
              <div>
                <p className={styles.eyebrow}>How JPV Bootcamp works</p>
                <h2 className={styles.sectionHeading}>
                  Everything you need to understand property investment, in one
                  place.
                </h2>
              </div>
              <div>
                <p className={styles.sectionIntro}>
                  Structured teaching, practical application, and ongoing
                  support stay connected throughout your journey.
                </p>
                <p className={styles.sectionIntro}>Final module titles and learning-outcome wording are pending client approval.</p>
              </div>
            </div>

            <div className={styles.journeyGrid}>
              {journeyCards.map((card) => (
                <article className={styles.journeyCard} key={card.number}>
                  <div className={styles.journeyMedia}>
                    <Image alt="" height={720} src={card.image} width={720} />
                  </div>
                  <div className={styles.journeyBody}>
                    <span className={styles.journeyNumber}>{card.number}</span>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                    <ul>
                      {card.items.map((item) => (
                        <li key={item}>
                          <Check aria-hidden="true" size={13} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.principle}>
          <div className={styles.narrow}>
            <p className={styles.eyebrow}>A daily principle</p>
            <h2 className={styles.sectionHeading}>
              Invest wisely. Steward faithfully. Bless generously.
            </h2>
            <div className={styles.principleCard}>
              <div className={styles.principleMark}>
                <span>
                  LEARN
                  <br />
                  APPLY
                  <br />
                  BUILD
                </span>
              </div>
              <div className={styles.principleCopy}>
                <h3>A practical rhythm</h3>
                <p>
                  Choose your membership, verify your account, and enter the
                  member portal. From there, your available programme,
                  resources, community, and billing tools remain connected in
                  one place.
                </p>
                <button
                  className={styles.plainLink}
                  onClick={() => setIsHowItWorksOpen(true)}
                  type="button"
                >
                  See the onboarding steps{" "}
                  <ArrowRight aria-hidden="true" size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.portalBand}>
          <div className={`${styles.container} ${styles.portalBandInner}`}>
            <div>
              <h2>Your programme, resources, and community in one place.</h2>
              <p>Member access stays protected inside the JPV portal.</p>
            </div>
            <a className={styles.buttonLight} href={signInHref}>
              Enter the member portal{" "}
              <ArrowRight aria-hidden="true" size={15} />
            </a>
          </div>
        </section>

        <section className={styles.community} id="community">
          <div className={`${styles.container} ${styles.communityGrid}`}>
            <div className={styles.communityMedia}>
              <Image
                alt="A live learning event with a large audience"
                height={900}
                src="/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg"
                width={1200}
              />
              <div className={styles.communityNote}>
                <strong>Learning is stronger in community.</strong>
                <span>
                  Training, practical discussion, and shared purpose stay
                  connected.
                </span>
              </div>
            </div>
            <div className={styles.communityCopy}>
              <p className={styles.eyebrow}>Community</p>
              <h2 className={styles.sectionHeading}>
                You don&apos;t have to build alone.
              </h2>
              <p>
                Join a community committed to excellence, accountability, and
                growth. Follow your training content, join available
                discussions, ask practical questions, and learn alongside other
                students and members.
              </p>
              <ul className={styles.benefitList}>
                {[
                  "Available member discussions",
                  "Programme questions and answers",
                  "Shared practical learning",
                  "Protected member resources",
                ].map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" size={13} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className={styles.communityActions}>
                <a className={styles.button} href="#pricing">
                  Become a Member
                </a>
                <button
                  className={styles.buttonOutline}
                  onClick={() => setIsHowItWorksOpen(true)}
                  type="button"
                >
                  How onboarding works
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.teachers} id="about">
          <div className={`${styles.container} ${styles.teacherGrid}`}>
            <div>
              <p className={styles.eyebrow}>Meet your teachers</p>
              <h2 className={styles.sectionHeading}>
                Guidance from people who understand the journey.
              </h2>
            </div>
            <div className={styles.teacherCards}>
              {["Athina Amadi", "Koprinka Aksaray", "Guest Speakers"].map(
                (name) => (
                  <article className={styles.teacherCard} key={name}>
                    <span aria-hidden="true" className={styles.teacherInitial}>
                      {name.charAt(0)}
                    </span>
                    <h3>{name}</h3>
                    <p>
                      More information will be added when approved content is
                      available.
                    </p>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section className={styles.proof} id="success-stories">
          <div className={styles.container}>
            <p className={styles.eyebrow}>Success stories</p>
            <h2 className={styles.sectionHeading}>
              Real stories will be shared here.
            </h2>
            <hr className={styles.proofRule} />
            <p>
              Client-approved member stories and testimonials are still being
              prepared. We will not fill this space with invented claims.
            </p>
          </div>
        </section>

        <section className={styles.pricing} id="pricing">
          <div className={styles.container}>
            <div className={styles.centredHeading}>
              <p className={styles.eyebrow}>Choose your plan</p>
              <h2 className={styles.sectionHeading}>
                Become a JPV Bootcamp Member.
              </h2>
              <p className={styles.sectionIntro}>
                The same membership and access, with the billing rhythm that
                works for you.
              </p>
            </div>
            <div className={styles.plans}>
              {pricingPlans.map((plan) => (
                <article
                  aria-label={plan.contractLabel}
                  className={`${styles.plan} ${plan.featured ? styles.planFeatured : ""}`}
                  data-contract-price={plan.contractPrice}
                  id={
                    plan.name === "Monthly"
                      ? "pricing-monthly"
                      : "pricing-annual"
                  }
                  key={plan.name}
                >
                  {plan.featured ? (
                    <span className={styles.planBadge}>Best value</span>
                  ) : null}
                  <p className={styles.planName}>{plan.name}</p>
                  <div className={styles.planPrice}>
                    <strong>{plan.price}</strong>
                    <span>{plan.suffix}</span>
                  </div>
                  <p className={styles.planDescription}>{plan.description}</p>
                  <ul className={styles.planFeatures}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check aria-hidden="true" size={13} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    className={
                      plan.featured ? styles.button : styles.buttonOutline
                    }
                    href={plan.ctaHref}
                  >
                    {plan.ctaLabel} <ArrowRight aria-hidden="true" size={15} />
                  </a>
                </article>
              ))}
            </div>
            <p className={styles.legalCopy}>
              Checkout requires email, telephone number, a payment method, and
              recurring-payment acknowledgement. Plan changes take effect
              according to the current billing terms.
            </p>
          </div>
        </section>

        <section className={styles.support} id="support">
          <div className={styles.container}>
            <div className={styles.supportBox}>
              <div>
                <p className={styles.eyebrow}>Support and pay it forward</p>
                <h2>Help make access possible.</h2>
                <p>
                  Use the existing JPV support and pay-it-forward path.
                  Questions about your account can be sent through the support
                  form.
                </p>
                <div className={styles.supportActions}>
                  <button
                    className={styles.buttonLight}
                    onClick={openSupportForm}
                    type="button"
                  >
                    Ask for support
                  </button>
                  <a
                    className={`${styles.buttonOutline} ${styles.buttonOnDark}`}
                    href="/sponsored"
                  >
                    Sponsored access
                  </a>
                </div>
              </div>
              <div className={styles.supportWidget}>
                <SponsoredPayItForward />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.faq} id="faq">
          <div className={styles.narrow}>
            <div className={styles.centredHeading}>
              <p className={styles.eyebrow}>Questions</p>
              <h2 className={styles.sectionHeading}>
                Frequently Asked Questions.
              </h2>
            </div>
            <div className={styles.faqList}>
              {faqItems.map((item) => (
                <details className={styles.faqItem} key={item.question}>
                  <summary>
                    {item.question}
                    <ChevronDown aria-hidden="true" size={16} />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div className={styles.footerBrand}>
            <Image
              alt="JPV Jesus Property Venture"
              height={38}
              src={jpvBrand.logoPath}
              width={38}
            />
            <div>
              <strong>JPV Bootcamp</strong>
              <span>
                © {new Date().getFullYear()} JPV. All rights reserved.
              </span>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/cookies">Cookies</a>
            <button onClick={openSupportForm} type="button">
              Support
            </button>
            <a
              href="https://prochat.tools"
              rel="nofollow noopener noreferrer"
              target="_blank"
            >
              Powered by ProChat
            </a>
          </div>
        </div>
      </footer>

      <AccessibleDialog
        className="max-h-[calc(100vh-2.5rem)] w-[calc(100%-2.5rem)] max-w-xl overflow-y-auto"
        describedBy="how-it-works-desc"
        labelledBy="how-it-works-title"
        onClose={() => setIsHowItWorksOpen(false)}
        open={isHowItWorksOpen}
      >
        <section className={styles.modal}>
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="jpv-eyebrow">Your next steps</p>
              <h2 className="mt-3 text-2xl font-bold" id="how-it-works-title">
                How onboarding works
              </h2>
              <p
                className="mt-2 text-sm leading-6 text-jpv-muted"
                id="how-it-works-desc"
              >
                A quick overview of what happens after you choose a membership.
              </p>
            </div>
            <button
              aria-label="Close onboarding steps"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-jpv-border hover:bg-jpv-surface"
              onClick={() => setIsHowItWorksOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </div>
          <ol className="mt-7 space-y-4">
            {onboardingSteps.map((step, index) => (
              <li
                className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-2xl bg-jpv-surface p-4"
                key={step.title}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-jpv-green text-sm font-bold">
                  {index + 1}
                </span>
                <div>
                  <p className="font-bold">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-jpv-muted">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <button
            className={`${styles.buttonOutline} mt-7 w-full`}
            onClick={() => setIsHowItWorksOpen(false)}
            type="button"
          >
            Close
          </button>
        </section>
      </AccessibleDialog>

      <AccessibleDialog
        className="max-h-[calc(100vh-2.5rem)] w-[calc(100%-2.5rem)] max-w-xl overflow-y-auto"
        describedBy="support-desc"
        labelledBy="support-title"
        onClose={handleSupportCancel}
        open={isSupportOpen}
      >
        <section className={styles.modal}>
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="jpv-eyebrow">We are here to help</p>
              <h2 className="mt-3 text-2xl font-bold" id="support-title">
                Support
              </h2>
              <p
                className="mt-2 text-sm leading-6 text-jpv-muted"
                id="support-desc"
              >
                Send your question to the JPV Bootcamp team.
              </p>
            </div>
            <button
              aria-label="Close support form"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-jpv-border hover:bg-jpv-surface"
              onClick={handleSupportCancel}
              type="button"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </div>

          {supportStatus !== "idle" ? (
            <div
              aria-atomic="true"
              aria-live="polite"
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${supportStatus === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-jpv-border bg-jpv-surface text-jpv-ink"}`}
              role="status"
            >
              {supportStatus === "success"
                ? "Thanks. Your request has been saved for review."
                : null}
              {supportStatus === "error" ? supportError : null}
              {supportStatus === "sending" ? "Saving your request…" : null}
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSupportSubmit}>
            <div>
              <label className="text-sm font-semibold" htmlFor="support-name">
                Name
              </label>
              <input
                className={inputClassName}
                disabled={isSupportSending}
                id="support-name"
                onChange={(event) => {
                  setSupportStatus("idle");
                  setSupportError(null);
                  setSupportName(event.target.value);
                }}
                required
                type="text"
                value={supportName}
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="support-email">
                Email address
              </label>
              <input
                autoComplete="email"
                className={inputClassName}
                disabled={isSupportSending}
                id="support-email"
                onChange={(event) => {
                  setSupportStatus("idle");
                  setSupportError(null);
                  setSupportEmail(event.target.value);
                }}
                required
                type="email"
                value={supportEmail}
              />
            </div>
            <div>
              <label
                className="text-sm font-semibold"
                htmlFor="support-question"
              >
                How can we help?
              </label>
              <textarea
                className={`${inputClassName} resize-y`}
                disabled={isSupportSending}
                id="support-question"
                onChange={(event) => {
                  setSupportStatus("idle");
                  setSupportError(null);
                  setSupportQuestion(event.target.value);
                }}
                required
                rows={5}
                value={supportQuestion}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className={styles.buttonOutline}
                onClick={handleSupportCancel}
                type="button"
              >
                Keep browsing
              </button>
              <button
                className={styles.button}
                disabled={isSupportSending}
                type="submit"
              >
                {isSupportSending ? "Sending question…" : "Send question"}
              </button>
            </div>
          </form>
        </section>
      </AccessibleDialog>
    </main>
  );
}
