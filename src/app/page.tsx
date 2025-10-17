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
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <header className="bg-black/80 backdrop-blur border-b border-jpv-gray-700/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5">
          <div className="text-xl font-semibold tracking-tight text-white">JPV Bootcamp</div>
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
          <div className="grid w-full max-w-4xl grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-light/60 p-6 text-left shadow-jpv-card backdrop-blur"
              >
                <div className="text-3xl font-semibold text-jpv-green md:text-4xl">{stat.value}</div>
                <p className="mt-2 text-sm text-jpv-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="curriculum" className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">What you&rsquo;ll learn</h2>
            <p className="mt-4 text-base text-jpv-gray-400 md:text-lg">
              Nail the fundamentals, master the numbers, and execute confident deals with mentors by your side.
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
                  <p className="mt-2 text-sm text-jpv-gray-400">
                    Curated lessons and live breakdowns to move you from curious to confident.
                  </p>
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
            <h2 className="text-3xl font-semibold md:text-4xl">Progress faster with your deal room</h2>
            <p className="text-base text-jpv-gray-400 md:text-lg">
              Tap into peer accountability, weekly analysis threads, and coach office hours. Share numbers, get feedback, and learn from real-world wins and lessons.
            </p>
            <a
              href="#join"
              className="inline-flex items-center justify-center rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Unlock access
            </a>
          </div>
          <div className="w-full max-w-md rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-light/70 p-8 shadow-jpv-card backdrop-blur">
            <div className="mb-6 flex items-center justify-between text-sm text-jpv-gray-400">
              <span>#deal-reviews</span>
              <span>Live</span>
            </div>
            <div className="space-y-5 text-sm text-jpv-gray-200">
              {communityMessages.map((message) => (
                <div key={message.author + message.content} className="space-y-1 rounded-2xl bg-jpv-bg-dark/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-jpv-green/90">{message.author}</p>
                  <p className="text-sm text-jpv-gray-200">{message.content}</p>
                </div>
              ))}
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
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold md:text-4xl">Simple pricing</h2>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 md:text-lg">
              One membership unlocks every module, weekly coaching, and community access. Cancel anytime and keep what you learn.
            </p>
          </div>
          <div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-10 shadow-jpv-card backdrop-blur">
            <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between md:text-left">
              <div>
                <p className="text-sm uppercase tracking-[0.3rem] text-jpv-green/80">Monthly</p>
                <div className="mt-2 flex items-end gap-2 text-4xl font-semibold text-white">
                  <span>£149</span>
                  <span className="text-sm font-normal text-jpv-gray-400">per month</span>
                </div>
                <p className="mt-4 text-sm text-jpv-gray-400">
                  VAT included for UK customers. Pause or cancel whenever you like.
                </p>
              </div>
              <a
                href="#join"
                className="inline-flex items-center justify-center rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
              >
                Join the bootcamp
              </a>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t border-jpv-gray-700/40 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-jpv-gray-500 sm:flex-row">
          <span>© {new Date().getFullYear()} JPV Bootcamp. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="#terms" className="transition hover:text-jpv-green">
              Terms
            </a>
            <a href="#privacy" className="transition hover:text-jpv-green">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
