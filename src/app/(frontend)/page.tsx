"use client";

import { ArrowRight, Check, ChevronDown, FolderOpen, GraduationCap, Home, Menu, Users, X } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

import SponsoredPayItForward from "@/components/sponsored-pay-it-forward";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";
import { landingSans, landingSerif } from "@/fonts";
import { jpvBrand } from "@/lib/brand/jpvDesignSystem";

import styles from "./landing.module.scss";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#who" },
  { label: "Membership", href: "#membership" },
  { label: "Community", href: "#community" },
  { label: "Events", href: "#how-it-works" },
  { label: "Success Stories", href: "#success-stories" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#support" },
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
    title: "Knowledge & Guidance",
    description: "Learn the principles. Build the knowledge. Invest with confidence.",
    image: "/images/redesign/pillar-structured-learning.png",
  },
  {
    title: "Practical Application",
    description: "Put learning into action through real property strategies and opportunities.",
    image: "/images/redesign/pillar-practical-application.png",
  },
  {
    title: "Live Experiences",
    description: "Connect with experts, gain practical insight and apply action.",
    image: "/images/redesign/pillar-live-experiences.png",
  },
  {
    title: "Community & Accountability",
    description: "Grow together with people who share your vision, Christian values and ambition.",
    image: "/images/redesign/pillar-community-support.png",
  },
] as const;

const journeyPillars = [
  {
    Icon: GraduationCap,
    title: "Training & Courses",
    description:
      "Learn at your own pace with step-by-step training and expert guidance.",
  },
  {
    Icon: Users,
    title: "Community & Connection",
    description:
      "Join a community of like-minded Christians in property. Share, learn and grow together.",
  },
  {
    Icon: FolderOpen,
    title: "Resource Library",
    description:
      "Access templates, documents, checklists and tools to support you every step of the way.",
  },
  {
    Icon: Home,
    title: "Practical Support",
    description:
      "From finding your first property to renovating, financing, and beyond – we've got you.",
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
  const [startedVideos, setStartedVideos] = useState<Set<string>>(new Set());
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
              alt="JPV — Our passion is people"
              className={styles.brandLogoTransparent}
              height={44}
              priority
              src={jpvBrand.logoHorizontalPath}
              width={180}
            />
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
              <p className={styles.eyebrow}>About JPV Bootcamp</p>
              <h2 className={styles.sectionHeading}>
                Let&apos;s do it together.
              </h2>
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
                alt="JPV key handoff — property education with purpose"
                height={1200}
                src="/images/redesign/jpv-key-handoff.png"
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
              {journeyPillars.map((pillar) => (
                <article className={styles.journeyCard} key={pillar.title}>
                  <div className={styles.journeyPillarIcon}>
                    <pillar.Icon aria-hidden="true" size={28} />
                  </div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.membership} id="membership">
          <div className={styles.container}>
            <div className={styles.centredHeading}>
              <p className={styles.eyebrow}>What Your Membership Gives You</p>
              <h2 className={styles.sectionHeading}>
                14 Reasons to Join JPV Bootcamp
              </h2>
              <p className={styles.sectionIntro}>
                Your training is only the beginning. We don&apos;t want to train you and then leave you on your own.
              </p>
            </div>
            <div className={styles.benefitsGrid}>
              {[
                { title: "Training That Never Stops", body: "Access to property training, courses, workshops and educational content designed to help you grow from your first deal to building a substantial portfolio." },
                { title: "A Christian Property Community", body: "Connect with like-minded Christians who share your faith, values and desire to build through property while supporting one another." },
                { title: "Your Own Property Network", body: "Meet people who can become future JV partners, investors, mentors, contractors, deal sourcers and business connections." },
                { title: "Private Groups & Rooms", body: "Have your own private spaces to communicate with your group, hold video meetings, discuss projects and build relationships away from the wider community." },
                { title: "1-to-1 & Private Messaging", body: "Communicate privately with other members, build relationships and discuss opportunities directly." },
                { title: "Property Resources Library", body: "Access documents, templates, guides, checklists and other resources you need throughout your property journey, all in one place." },
                { title: "Find Your First Property", body: "Get practical guidance on how to identify, assess and secure the right property rather than simply learning the theory." },
                { title: "Help to Finance Your First Deal", body: "Understand funding options and receive support as you work towards financing your first property." },
                { title: "Renovation & Development Support", body: "Get guidance through the renovation process, including planning your works, understanding costs and finding suitable contractors." },
                { title: "Contractor & Professional Connections", body: "Access a growing network of people who can help you move your projects forward." },
                { title: "Support From Purchase to Exit", body: "Your journey doesn't end when you buy. Get guidance through renovation, letting, refinancing, selling and the next stage of your strategy." },
                { title: "Build JVs With Other Members", body: "Find people within the community whose skills, experience, capital or opportunities complement your own and explore joint ventures together." },
                { title: "Build Your Portfolio", body: "Once you complete your first deal, continue using the platform to find your next opportunity and develop a long-term property strategy." },
                { title: "Stay Accountable", body: "Don't disappear after completing your training. Stay connected to a community that can encourage you, challenge you and help you keep moving forward." },
              ].map((benefit, i) => (
                <article className={styles.benefitCard} key={benefit.title}>
                  <span className={styles.benefitNumber} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.body}</p>
                </article>
              ))}
            </div>
            <p className={styles.membershipCta}>
              Your membership gives you access to an ongoing Christian property community where you can continue learning, building relationships, finding opportunities and receiving practical support as you build your property journey.
            </p>
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
                alt="Property that serves people — community development"
                height={900}
                src="/images/redesign/community-section.png"
                width={1200}
              />
            </div>
            <div className={styles.communityCopy}>
              <p className={styles.eyebrow}>More Than Property. A Community With Purpose.</p>
              <h2 className={styles.sectionHeading}>
                We Don&apos;t Build Alone.
              </h2>
              <p>
                JPV Bootcamp is a living Christian property investment community — people coming together to learn, pray, take action and build together.
              </p>
              <p>
                We&apos;re not just learning about property. We&apos;re learning about ourselves. As we grow in knowledge, confidence and faith, we challenge the mindsets that have held us back and discover what we are capable of building.
              </p>
              <p>
                Together, we&apos;re buying properties, developing businesses, creating opportunities and supporting one another through the challenges and victories along the way. There is practical support, prayer, accountability, friendship and genuine partnership.
              </p>
              <p className={styles.communityMantra}>
                We learn together. We pray together. We build together. We grow together.
              </p>
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
              <article className={styles.teacherCard}>
                <div className={styles.teacherPhoto}>
                  <Image
                    alt="Athina Amadi"
                    height={400}
                    src="/images/redesign/instructor-athina.png"
                    width={400}
                  />
                </div>
                <h3>Athina Amadi</h3>
                <p className={styles.teacherRole}>
                  Founder &amp; CEO, JCCP Holdings &amp; JC Citadels Capital Ltd | Founder, JPV Bootcamp
                </p>
                <p>
                  With over 20 years&apos; experience in property and 28 years in Christian ministry, Athina has led major residential, commercial, and social housing projects across the UK and internationally, combining commercial expertise with a passion for creating lasting social impact.
                </p>
                <p>
                  Athina has successfully delivered property transactions ranging from residential developments to landmark commercial projects, working alongside architects, contractors, and planning professionals. She leads several diversified businesses focused on property, sustainable ventures, finance, food, water, and energy, while equipping aspiring Christian property investors with the knowledge and confidence to build wealth through property.
                </p>
                <p>
                  Her mission is to equip people with practical strategies, Kingdom principles, and the mindset to build sustainable wealth, create generational legacy, and become transformational leaders in business and their communities.
                </p>
              </article>
              <article className={styles.teacherCard}>
                <div className={styles.teacherPhoto}>
                  <Image
                    alt="Koprinka Aksaray"
                    height={400}
                    src="/images/redesign/instructor-koprinka.png"
                    width={400}
                  />
                </div>
                <h3>Koprinka Aksaray</h3>
                <p className={styles.teacherRole}>
                  Chief Operating Officer, JCCP Holdings | International Property Investment Strategist
                </p>
                <p>
                  With over 20 years of experience across the UK, Europe, and Africa, Koprinka has built extensive expertise in property investment, large-scale developments, and international acquisitions.
                </p>
                <p>
                  Throughout her career, Koprinka has contributed to landmark regeneration projects, including the iconic Battersea Power Station redevelopment, alongside numerous commercial and residential developments. She has successfully raised £22 million for an international development project and gained valuable private equity experience through business acquisitions and cross-sector investments.
                </p>
                <p>
                  Driven by a passion for innovation and sustainability, Koprinka is committed to creating resilient, future-ready communities that generate long-term economic and social impact.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.proof} id="success-stories">
          <div className={styles.container}>
            <div className={styles.centredHeading}>
              <p className={styles.eyebrow}>Real Stories &amp; Testimonies</p>
              <h2 className={styles.sectionHeading}>
                Across the UK, our members are achieving life-changing results.
              </h2>
              <p className={styles.sectionIntro}>
                From Glasgow to London, Portsmouth, and Bradford, people from a wide range of backgrounds have turned their property ambitions into reality — many securing their very first investment property within just a few months of joining.
              </p>
            </div>
            <div className={styles.testimonialGrid}>
              {[
                {
                  name: "Raouda",
                  location: "Glasgow, Scotland",
                  quote: "We've just purchased our first property in Wales. This has been an incredible experience, and I'm so grateful for the support and guidance from Athina and Koprinka throughout the entire process.",
                  videoId: "ca8db1b6-b7eb-4930-8403-9919d131629c",
                },
                {
                  name: "Chosen",
                  location: "Portsmouth",
                  quote: "A couple of months ago, we secured our first property, and it's been incredible to see our dream of property ownership come to life. I truly believe this is just the first of many.",
                  videoId: "56266f09-d651-4bc5-a5b0-ac9185018018",
                },
                {
                  name: "Tolu",
                  location: "London",
                  quote: "One of the biggest highlights for me has been discovering and developing my leadership skills. The experience has been invaluable, not only within the group but also for my own property company.",
                  videoId: "a2d9e18b-eb0b-4d3f-b0e7-31daf7cd6c62",
                },
                {
                  name: "Adanna",
                  location: "Bradford",
                  quote: "In such a short space of time, I've already become a property owner. It's an achievement I truly value, and I wouldn't trade this experience for anything.",
                  videoId: "4cb8f04f-8b29-4d0d-81b6-5bb4caead36d",
                },
                {
                  name: "Pauline",
                  location: "London",
                  quote: "After just a couple of months, I've become a property owner. I truly thank God for that blessing. I would highly recommend JPV Property to anyone looking to start or grow their property journey.",
                  videoId: "cda4b492-91af-430d-9bba-4268ccaf8cc2",
                },
              ].map((t) => (
                <article
                  className={styles.testimonialCard}
                  key={t.name}
                  onMouseEnter={() =>
                    setStartedVideos((prev) => new Set([...prev, t.videoId]))
                  }
                >
                  <div className={styles.testimonialVideo}>
                    <iframe
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                      allowFullScreen
                      src={`https://iframe.mediadelivery.net/embed/581531/${t.videoId}?autoplay=${startedVideos.has(t.videoId) ? "true" : "false"}&loop=false&muted=true&preload=true`}
                      style={{ border: 0, height: "100%", left: 0, position: "absolute", top: 0, width: "100%" }}
                      title={`${t.name} testimonial`}
                    />
                  </div>
                  <blockquote className={styles.testimonialQuote}>
                    <p>&ldquo;{t.quote}&rdquo;</p>
                    <footer>
                      <strong>{t.name}</strong>
                      <span>{t.location}</span>
                    </footer>
                  </blockquote>
                </article>
              ))}
            </div>
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
              alt="JPV — Our passion is people"
              className={styles.footerLogoTransparent}
              height={40}
              src={jpvBrand.logoHorizontalPath}
              width={160}
            />
            <span>
              © {new Date().getFullYear()} JPV. All rights reserved.
            </span>
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
