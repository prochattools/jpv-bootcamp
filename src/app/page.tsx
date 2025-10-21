import Image from "next/image";

export default function HomePage() {
  const navLinks = [
    { label: "Curriculum", href: "#curriculum" },
    { label: "Community", href: "#community" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];
  const stats = [
    { value: "3,200+", label: "Learners" },
    { value: "18%", label: "Avg ROI" },
    { value: "25", label: "Cities" },
    { value: "900+", label: "Deals reviewed" },
  ];
  const coreFocus = ["FCA basics", "Deal analysis", "Funding", "Lettings"];
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
  const pricingPlans = [
    {
      name: "Starter",
      price: "Free",
      description: "Get a feel for it",
      features: ["2 intro lessons", "Weekly newsletter", "Community read-only", "Basic calculators"],
      ctaLabel: "Create free account",
      ctaHref: "#starter",
      highlight: false,
    },
    {
      name: "Pro",
      price: "£39/mo",
      description: "Everything to get profitable",
      features: ["Full course library", "Live monthly Q&A", "Deal analysis templates", "Active community access"],
      ctaLabel: "Start Pro",
      ctaHref: "#pro",
      highlight: true,
      badge: "Most popular",
      subcopy: "7-day money-back guarantee",
    },
    {
      name: "VIP",
      price: "£149/mo",
      description: "Hands-on support",
      features: ["All Pro features", "Weekly group coaching", "1:1 deal review (monthly)", "Priority support"],
      ctaLabel: "Apply for VIP",
      ctaHref: "#vip",
      highlight: false,
    },
  ];
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <header className="bg-black/80 backdrop-blur border-b border-jpv-gray-700/40">
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
              href="#signin"
              className="rounded-full border border-jpv-gray-700 px-5 py-2 text-sm text-jpv-gray-200 transition hover:bg-jpv-bg-light hover:text-white"
            >
              Sign in
            </a>
            <a
              href="#join"
              className="rounded-full bg-jpv-green px-5 py-2 text-sm font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Join
            </a>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-jpv-gray-700 p-2 text-jpv-gray-200 transition hover:border-jpv-green hover:text-jpv-green lg:hidden"
          >
            <span className="sr-only">Open navigation</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 text-center">
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
              href="#join"
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
          <p className="text-sm text-jpv-gray-400 sm:text-base">7-day money-back guarantee · Cancel anytime</p>
          <div className="w-full max-w-4xl space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {coreFocus.map((topic) => (
                <div
                  key={topic}
                  className="flex items-center justify-center rounded-full border border-jpv-gray-700/50 bg-jpv-bg-dark/40 px-4 py-4 text-sm font-medium text-jpv-gray-200 shadow-jpv-card backdrop-blur sm:px-6"
                >
                  {topic}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex h-full flex-col items-center justify-center rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-light/60 p-6 text-center shadow-jpv-card backdrop-blur"
                >
                  <div className="text-3xl font-semibold text-jpv-green md:text-4xl">{stat.value}</div>
                  <p className="mt-2 text-sm text-jpv-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section id="curriculum" className="px-6 py-24 sm:py-28">
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
        className="relative border-y border-jpv-gray-700/40 bg-jpv-bg-dark/70 px-6 py-24 sm:py-28"
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
                href="#join"
                className="inline-flex items-center justify-center rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
              >
                Unlock access
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-10 py-3 text-base font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
              >
                How it works
              </a>
            </div>
          </div>
          <div className="w-full max-w-md rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-light/70 p-8 shadow-jpv-card backdrop-blur">
            <div className="mb-6 flex items-center justify-between text-sm text-jpv-gray-400">
              <span>#deal-analysis</span>
              <span>Live</span>
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
      <section id="pricing" className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12 text-center md:text-left">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Simple pricing</h2>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 md:text-lg">
              Choose a plan, cancel anytime. VAT included for UK customers.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`flex h-full flex-col justify-between rounded-3xl border p-8 shadow-jpv-card backdrop-blur ${
                  plan.highlight
                    ? "border-jpv-green/60 bg-jpv-bg-light/80"
                    : "border-jpv-gray-700/50 bg-jpv-bg-dark/60"
                }`}
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
                  <a
                    href={plan.ctaHref}
                    className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition ${
                      plan.highlight
                        ? "bg-jpv-green text-black shadow-jpv-glow hover:bg-jpv-green-hover"
                        : "border border-jpv-gray-600 text-jpv-gray-200 hover:border-jpv-green hover:text-white"
                    }`}
                  >
                    {plan.ctaLabel}
                  </a>
                  {plan.subcopy ? <p className="text-xs text-jpv-green/80">{plan.subcopy}</p> : null}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-jpv-gray-400">
            Need invoicing for teams? Contact us for group pricing.
          </p>
        </div>
      </section>
      <section id="faq" className="px-6 py-24 sm:py-28">
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
            <span>© {new Date().getFullYear()} JPV {"\u2022"} Jesus Property Venture. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#terms" className="transition hover:text-jpv-green">
              Terms
            </a>
            <a href="#privacy" className="transition hover:text-jpv-green">
              Privacy
            </a>
            <a href="#support" className="transition hover:text-jpv-green">
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
