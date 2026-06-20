export const metadata = {
  title: "Upgrade to VIP | JPV Bootcamp",
  description: "Move from Pro to VIP for hands-on coaching and priority support.",
};

const signInHref = "https://portal.jpvbootcamp.com/community/?fcom_action=auth";
const signUpHref = "https://portal.jpvbootcamp.com/community?fcom_action=auth&form=register";
const portalUpgradeUrl = process.env.NEXT_PUBLIC_PORTAL_UPGRADE_URL || signInHref;
const supportHref = "mailto:jpvbootcamp@gmail.com?subject=VIP%20Upgrade%20Support";

const vipBenefits = [
  "Weekly group coaching with a senior mentor",
  "Monthly 1:1 deal review and accountability check-in",
  "Priority support with faster turnaround",
  "VIP-only market deep dives and sourcing reviews",
  "Exclusive templates, calculators, and deal audits",
];

const upgradeSteps = [
  {
    title: "Sign in to the portal",
    description: "Access your account to manage billing and membership.",
  },
  {
    title: "Open Billing / Membership",
    description: "Find the billing area in your member dashboard.",
  },
  {
    title: "Choose the VIP upgrade",
    description: "Confirm the change and your plan updates instantly.",
  },
];

export default function UpgradePage() {
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 text-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">VIP Upgrade</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">Upgrade to VIP</h1>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 sm:text-lg">
              Move from Pro to VIP for hands-on coaching and priority support.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
            <a
              href={portalUpgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Go to portal to upgrade
            </a>
            <a
              href={supportHref}
              className="rounded-full border border-jpv-gray-600 px-10 py-3 text-base font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
            >
              Contact support
            </a>
          </div>
          <div className="flex flex-col items-center gap-3 text-sm text-jpv-gray-400 sm:flex-row">
            <a
              href={signInHref}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-jpv-green"
            >
              Sign in
            </a>
            <span className="text-jpv-green">•</span>
            <a
              href={signUpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-jpv-green"
            >
              Create an account
            </a>
            <span className="text-jpv-green">•</span>
            <a href="/" className="transition hover:text-jpv-green">
              Back to main site
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">What you get</h2>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 md:text-lg">
              VIP members get deeper coaching, faster feedback, and higher-touch support.
            </p>
          </div>
          <div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
            <ul className="space-y-2 text-left text-sm text-jpv-gray-200">
              {vipBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="text-jpv-green">•</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-jpv-gray-700/40 bg-jpv-bg-dark/70 px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">Upgrade steps</p>
            <h2 className="text-3xl font-semibold md:text-4xl">Upgrade steps</h2>
            <p className="text-base text-jpv-gray-400 md:text-lg">
              These steps are placeholders while the upgrade flow is finalized.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {upgradeSteps.map((step, index) => (
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
    </main>
  );
}
