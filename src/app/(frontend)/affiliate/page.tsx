export const metadata = {
  title: "Affiliate Program | JPV Bootcamp",
  description: "Earn commission by introducing new members to JPV Bootcamp.",
};

const signInHref = "https://portal.jpvbootcamp.com/community/?fcom_action=auth";
const signUpHref = "https://portal.jpvbootcamp.com/community?fcom_action=auth&form=register";
const applyHref = "mailto:jpvbootcamp@gmail.com?subject=Affiliate%20Application";

const affiliateResources = [
  {
    title: "Affiliate welcome pack",
    description: "Starter positioning, launch checklist, and sample outreach scripts.",
  },
  {
    title: "Referral link generator",
    description: "Create a tracked referral URL for every campaign you run.",
  },
  {
    title: "Brand assets",
    description: "Approved logos, colors, and social-ready creative placeholders.",
  },
  {
    title: "Payout schedule",
    description: "Monthly payout calendar with status updates and reporting.",
  },
];

const affiliateSteps = [
  {
    title: "Apply and get approved",
    description: "Tell us about your audience and we will confirm fit.",
  },
  {
    title: "Share your referral link",
    description: "Promote your unique link across email, socials, or events.",
  },
  {
    title: "Earn commission",
    description: "Track conversions and receive payouts on the published schedule.",
  },
];

const faqItems = [
  {
    question: "Who can apply?",
    answer: "Creators, community leaders, and partners aligned with our values are welcome to apply.",
  },
  {
    question: "When do payouts happen?",
    answer: "Payouts are issued monthly based on verified referrals for the prior cycle.",
  },
  {
    question: "Is there a minimum activity requirement?",
    answer: "No minimums yet. Stay active and keep your audience updated for best results.",
  },
  {
    question: "Can I track performance?",
    answer: "Yes, a dashboard is planned. For now, we will share monthly summaries by email.",
  },
];

export default function AffiliatePage() {
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 text-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">Affiliate</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">Affiliate Program</h1>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 sm:text-lg">
              Earn commission by introducing new members to JPV Bootcamp.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
            <a
              href={signInHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Sign in to portal
            </a>
            <a
              href={signUpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-jpv-gray-700 px-10 py-3 text-base font-medium text-white transition hover:bg-jpv-bg-light"
            >
              Create an account
            </a>
          </div>
          <a href="/" className="text-sm text-jpv-gray-400 transition hover:text-jpv-green">
            Back to main site
          </a>
        </div>
      </section>

      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Affiliate resources</h2>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 md:text-lg">
              Tools and templates to help you introduce the program with confidence.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {affiliateResources.map((resource) => (
              <div
                key={resource.title}
                className="flex h-full flex-col gap-6 rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur"
              >
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-white">{resource.title}</h3>
                  <p className="text-sm text-jpv-gray-400">{resource.description}</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-jpv-green/90">
                  Placeholder resource
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-jpv-gray-700/40 bg-jpv-bg-dark/70 px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">How it works</p>
            <h2 className="text-3xl font-semibold md:text-4xl">How it works</h2>
            <p className="text-base text-jpv-gray-400 md:text-lg">
              A simple three-step path to earning commissions with JPV Bootcamp.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {affiliateSteps.map((step, index) => (
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
        </div>
      </section>

      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="space-y-3 text-center md:text-left">
            <h2 className="text-3xl font-semibold md:text-4xl">FAQ</h2>
            <p className="text-base text-jpv-gray-400 md:text-lg">
              Quick answers to common affiliate questions.
            </p>
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

      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-light/70 p-8 text-center shadow-jpv-card backdrop-blur">
            <h2 className="text-2xl font-semibold text-white">Ready to partner with JPV?</h2>
            <p className="mt-3 text-base text-jpv-gray-400">
              This is a placeholder application route while we finalize the portal workflow.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={applyHref}
                className="inline-flex items-center justify-center rounded-full bg-jpv-green px-6 py-3 text-sm font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
              >
                Apply as an affiliate
              </a>
              <a
                href={signInHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-6 py-3 text-sm font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
              >
                Portal sign in
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
