export const metadata = {
  title: "Join Pro | JPV Bootcamp",
  description: "Choose the JPV Bootcamp Pro membership and manage your account inside the JPV platform.",
};

const signInHref = "/portal?mode=login";
const signUpHref = "/register";
const checkoutHref = "/api/stripe/checkout?plan=pro&billing=monthly";
const supportHref = "mailto:jpvbootcamp@gmail.com?subject=JPV%20Bootcamp%20Pro%20Support";

const proBenefits = [
  "One clear Pro membership",
  "Monthly payment with a 12-month commitment or annual upfront payment",
  "8-week course structure with mentorship modules",
  "Protected resources, course progress, and community access",
  "Billing self-service inside the JPV Bootcamp platform",
];

const joinSteps = [
  {
    title: "Create or sign in to your account",
    description: "Use the JPV Bootcamp member portal for account and billing access.",
  },
  {
    title: "Choose Pro",
    description: "Select the monthly or annual Pro payment option when checkout is available.",
  },
  {
    title: "Start learning",
    description: "Access the approved course, resources, account, billing, and community areas.",
  },
];

export default function UpgradePage() {
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <section className="px-6 py-24 sm:py-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 text-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.4rem] text-jpv-green/80">Pro Membership</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">Join JPV Bootcamp Pro</h1>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 sm:text-lg">
              Pro is the single paid JPV Bootcamp membership. Free access is reserved for approved support, pay-it-forward, staff, or administrator-created access.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
            <a
              href={checkoutHref}
              className="rounded-full bg-jpv-green px-10 py-3 text-base font-semibold text-black shadow-jpv-glow transition hover:bg-jpv-green-hover"
            >
              Start Pro
            </a>
            <a
              href={supportHref}
              className="rounded-full border border-jpv-gray-600 px-10 py-3 text-base font-semibold text-jpv-gray-200 transition hover:border-jpv-green hover:text-white"
            >
              Contact support
            </a>
          </div>
          <div className="flex flex-col items-center gap-3 text-sm text-jpv-gray-400 sm:flex-row">
            <a href={signInHref} className="transition hover:text-jpv-green">
              Sign in
            </a>
            <span className="text-jpv-green">•</span>
            <a href={signUpHref} className="transition hover:text-jpv-green">
              Apply for Free access
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
            <h2 className="text-3xl font-semibold md:text-4xl">What Pro includes</h2>
            <p className="mx-auto max-w-2xl text-base text-jpv-gray-400 md:text-lg">
              One membership, one clear offer, and self-service billing inside the new platform.
            </p>
          </div>
          <div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
            <ul className="grid gap-4 text-left text-sm text-jpv-gray-300 sm:grid-cols-2">
              {proBenefits.map((benefit) => (
                <li key={benefit} className="rounded-2xl border border-jpv-gray-700/50 bg-jpv-bg-light/50 p-4">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 sm:pb-28">
        <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
          <h2 className="text-3xl font-semibold">How joining works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {joinSteps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-jpv-gray-700/50 bg-jpv-bg-light/50 p-5 text-left">
                <p className="text-sm font-semibold text-jpv-green">Step {index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-jpv-gray-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
