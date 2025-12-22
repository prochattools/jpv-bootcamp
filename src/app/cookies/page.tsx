export default function CookiesPage() {
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <section className="px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-jpv-gray-400">
              JPV Bootcamp
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Cookie Policy</h1>
            <p className="text-base text-jpv-gray-400">
              Details on how cookies are used across the JPV Bootcamp website.
            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-jpv-gray-400">
                JPV Bootcamp Website Policies
              </p>
              <h2 id="introduction" className="mt-3 text-lg font-semibold text-white">
                1. Introduction
              </h2>
              <p className="mt-3 text-sm text-jpv-gray-300">
                Welcome to JPV Bootcamp (“we”, “us”, “our”). We are committed...sing
                jpvbootcamp.com (“Website”), you agree to these policies.
              </p>
            </div>

            <div className="space-y-4">
              <h2 id="cookie-policy" className="text-xl font-semibold text-white">
                4. Cookie Policy
              </h2>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="what-are-cookies" className="text-base font-semibold text-white">
                  What Are Cookies?
                </h3>
                <p className="mt-3 text-sm text-jpv-gray-300">
                  Cookies are small files stored on your device to help websites remember
                  preferences and improve functionality.
                </p>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="types-of-cookies" className="text-base font-semibold text-white">
                  Types of Cookies We Use
                </h3>
                <div className="mt-3 space-y-2 text-sm text-jpv-gray-300">
                  <h4 id="essential-cookies" className="text-sm font-semibold text-white">
                    Essential Cookies
                  </h4>
                  <p>
                    These are necessary for the Website to operate...out our use of cookies,
                    please contact us through the Website.
                  </p>
                </div>
              </div>
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
