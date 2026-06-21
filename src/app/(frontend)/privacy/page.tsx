export default function PrivacyPage() {
  return (
    <main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
      <section className="px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl space-y-10">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-jpv-gray-400">
              JPV Bootcamp
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Privacy Policy</h1>
            <p className="text-base text-jpv-gray-400">
              How we collect, use, and protect information on JPV Bootcamp.
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
              <h2 id="privacy-policy" className="text-xl font-semibold text-white">
                3. Privacy Policy
              </h2>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="information-collection" className="text-base font-semibold text-white">
                  Information Collection
                </h3>
                <div className="mt-3 space-y-3 text-sm text-jpv-gray-300">
                  <p>We collect information you provide when:</p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>Creating an account</li>
                    <li>Subscribing to a service</li>
                    <li>Participating in community discussions</li>
                    <li>Completing profile or purchase forms</li>
                  </ul>
                  <p>
                    This may include name, email address, payment details (processed by
                    Stripe), and any content you post.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="cookies-and-tracking" className="text-base font-semibold text-white">
                  Cookies &amp; Tracking
                </h3>
                <div className="mt-3 space-y-3 text-sm text-jpv-gray-300">
                  <p>We use cookies and similar tracking technologies to:</p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>Improve site performance</li>
                    <li>Personalize content</li>
                    <li>Analyse user behaviour</li>
                  </ul>
                  <p>You can adjust cookie preferences through your browser settings.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="use-of-personal-data" className="text-base font-semibold text-white">
                  Use of Personal Data
                </h3>
                <div className="mt-3 space-y-3 text-sm text-jpv-gray-300">
                  <p>We use your data to:</p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>Provide access to training and community services</li>
                    <li>Process subscription payments</li>
                    <li>Send updates, onboarding, and support replies</li>
                    <li>Analyse trends for enhancing the Website</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="sharing-of-information" className="text-base font-semibold text-white">
                  Sharing of Information
                </h3>
                <div className="mt-3 space-y-3 text-sm text-jpv-gray-300">
                  <p>We do not sell your personal data. We may share data with:</p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>Stripe (payment processing)</li>
                    <li>Hosting and analytics providers</li>
                    <li>Legal authorities if required</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="data-protection" className="text-base font-semibold text-white">
                  Data Protection
                </h3>
                <div className="mt-3 space-y-2 text-sm text-jpv-gray-300">
                  <p>We implement reasonable security measures to protect your information.</p>
                  <p>However, no system is fully secure, and users submit data at their own risk.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="user-rights" className="text-base font-semibold text-white">
                  User Rights
                </h3>
                <div className="mt-3 space-y-2 text-sm text-jpv-gray-300">
                  <p>You may request access, correction, or deletion of your personal data.</p>
                  <p>You may opt out of marketing communications at any time.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-jpv-gray-700/60 bg-jpv-bg-dark/70 p-6 shadow-jpv-card">
                <h3 id="contact" className="text-base font-semibold text-white">
                  Contact
                </h3>
                <p className="mt-3 text-sm text-jpv-gray-300">
                  For privacy-related inquiries, contact us through the Website.
                </p>
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
