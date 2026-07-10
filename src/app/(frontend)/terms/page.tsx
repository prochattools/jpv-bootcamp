export default function TermsPage() {
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <section className="px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-jpv-gray-400">
              JPV Bootcamp
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Terms of Use</h1>
            <p className="text-base text-jpv-gray-400">
              Current terms information for the JPV Bootcamp website and membership.
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
              <h2 className="text-lg font-semibold text-white">Approval status</h2>
              <p className="mt-3 text-sm text-jpv-gray-300">
                Final cancellation, renewal, refund, guarantee, and commitment wording is
                pending client and legal approval.
              </p>
            </div>

            <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
              <h2 className="text-lg font-semibold text-white">Membership and payments</h2>
              <p className="mt-3 text-sm text-jpv-gray-300">
                JPV Bootcamp offers controlled non-paid access and Pro membership. Current
                prices and checkout options are shown on the website. Card payments are
                processed through Stripe.
              </p>
            </div>

            <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
              <h2 className="text-lg font-semibold text-white">Questions</h2>
              <p className="mt-3 text-sm text-jpv-gray-300">
                Use the support form on the home page for questions about the current terms.
              </p>
            </div>
          </div>

          <a
            href="/#pricing"
            className="inline-flex items-center text-sm text-jpv-gray-400 transition hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jpv-green/60 focus-visible:ring-offset-2 focus-visible:ring-offset-jpv-bg-dark"
          >
            Back to home
          </a>
        </div>
      </section>
    </main>
  );
}
