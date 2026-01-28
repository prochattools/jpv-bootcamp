import Image from "next/image";

export const metadata = {
  title: "Inheritance Builders Bootcamp | JPV Bootcamp",
  description:
    "Inheritance Builders Bootcamp is a one-day Christian business gathering in London focused on biblical stewardship, business, and property for generational legacy.",
};

const navLinks = [
  { label: "Overview", href: "#overview" },
  { label: "Inheritance", href: "#inheritance" },
  { label: "Speakers", href: "#speakers" },
  { label: "Exhibitors", href: "#exhibitors" },
  { label: "Tickets", href: "#tickets" },
];

const eventHighlights = [
  {
    title: "Date",
    value: "Friday, 27 March 2026",
    meta: "One-day gathering | In-person",
  },
  {
    title: "Time",
    value: "11:00 AM - 4:00 PM",
    meta: "Registration opens at 10:30 AM",
  },
  {
    title: "Venue",
    value: "Emmanuel Centre",
    meta: "9-23 Marsham Street, London SW1P 3DW",
  },
];

const bootcampHighlights = [
  "One-day Christian gathering",
  "UK & international speakers",
  "Practical insights on business and property",
  "Biblical stewardship without religious heaviness",
  "Real testimonies from trained investors",
  "Purpose-driven, values-aligned networking",
];

const whyMatters = [
  "Wealth rarely lasts beyond a few generations without wisdom, structure, and stewardship.",
  "Many believers remain limited not because of calling, but because of tools, teaching, and access.",
  "Inheritance Builders equips people to break cycles of poverty, dependency, and fear with practical training.",
];

const impactPoints = [
  "Breaking chains of poverty",
  "Challenging captivity and limitation within the Body of Christ",
  "Creating pathways to ownership and provision",
  "Equipping believers to resource families, churches, and communities",
  "Preparing people to steward wealth for Kingdom impact",
];

const whoItsFor = [
  "Care about generational legacy",
  "Want faith and finances aligned",
  "Are exploring or active in business or property",
  "Desire wisdom, stewardship, and structure",
  "Believe provision should bless others, not stop with you",
];

const speakerNotes = [
  "Speakers from the UK and abroad",
  "Leaders with real-world experience",
  "Testimonies from trainees applying principles in everyday life",
];

const programPillars = ["Speakers & insights", "Networking with purpose", "Testimonies"];

export default function BuildersBootcampPage() {
  const flyerHref = "/events/inheritance-builders/Inheritance Builders Bootcamp Event Flyer.pdf";
  const hallLayoutHref =
    "/events/inheritance-builders/UPPER HALL LAYOUT - Exhibition Max Stalls Setup Example.pdf";
  const posterSrc = "/events/inheritance-builders/PHOTO-2026-01-27-20-28-15.jpg";
  const hallInteriorOne = "/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg";
  const hallInteriorTwo = "/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg";
  const venueEntrance = "/events/inheritance-builders/PHOTO-2026-01-27-22-10-32.jpg";
  const phoneDisplay = "0208 092 2398";
  const phoneHref = "tel:+442080922398";

  return (
    <main className="relative min-h-screen bg-jpv-gradient text-jpv-gray-50">
      <header className="absolute inset-x-0 top-0 z-50 border-b border-jpv-gray-700/40 bg-black/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-xl border border-jpv-gray-700/50">
              <Image
                src="/images/jpv-logo.jpg"
                alt="JPV - Jesus Property Venture logo"
                width={56}
                height={56}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="leading-tight">
              <span className="block text-xl font-bold tracking-tight text-white">JPV</span>
              <span className="block text-xs font-medium uppercase tracking-wider text-jpv-green">Our passion is people</span>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-jpv-gray-200 lg:flex">
            {navLinks.map((item) => (
              <a key={item.label} href={item.href} className="transition-colors hover:text-jpv-green">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <a
              href="/"
              className="text-sm font-medium text-jpv-gray-300 transition-colors hover:text-white"
            >
              Main site
            </a>
            <a
              href="#tickets"
              className="rounded-full bg-jpv-green px-6 py-2.5 text-sm font-bold text-black shadow-jpv-glow transition-all hover:scale-105 hover:bg-jpv-green-hover active:scale-95"
            >
              Register
            </a>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-jpv-gray-700 p-2.5 text-jpv-gray-200 transition-colors hover:border-jpv-green hover:text-jpv-green lg:hidden"
          >
            <span className="sr-only">Open navigation</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <section id="overview" className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-24">
        <div className="absolute inset-0 z-0">
          <Image
            src={hallInteriorOne}
            alt="Builders Bootcamp Venue"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr,450px]">
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-jpv-green/30 bg-jpv-green/5 px-4 py-1.5 md:px-5 md:py-2 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jpv-green opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-jpv-green"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-jpv-green md:text-sm">
                  One-Day Kingdom Business Gathering
                </span>
              </div>
              <h1 className="text-5xl font-black leading-[1.1] text-white drop-shadow-2xl sm:text-6xl lg:text-7xl xl:text-8xl">
                Inheritance <br />
                <span className="text-jpv-green">Builders</span> Bootcamp
              </h1>
              <p className="max-w-2xl text-xl font-medium text-white drop-shadow-lg md:text-2xl">
                Practical biblical stewardship, business, and property training for generational impact.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {eventHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="group relative overflow-hidden rounded-2xl border border-jpv-gray-700/50 bg-black/40 p-6 backdrop-blur-md transition-all hover:border-jpv-green/30 hover:bg-black/60"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-jpv-green/80 group-hover:text-jpv-green">
                    {highlight.title}
                  </p>
                  <p className="mt-3 text-lg font-bold text-white group-hover:text-jpv-green transition-colors">{highlight.value}</p>
                  <p className="mt-1 text-xs font-medium text-jpv-gray-300">{highlight.meta}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <a
                href="#tickets"
                className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-jpv-green px-12 py-5 text-lg font-black text-black shadow-jpv-glow transition-all hover:scale-[1.02] hover:bg-jpv-green-hover active:scale-95"
              >
                Register now
                <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href={flyerHref}
                download
                className="flex items-center justify-center gap-2 rounded-full border border-jpv-gray-700 bg-black/20 backdrop-blur-md px-8 py-5 text-lg font-bold text-white transition-all hover:border-jpv-green hover:bg-black/40"
              >
                Event Leaflet
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute -inset-4 rounded-[40px] bg-jpv-green/20 blur-2xl opacity-50" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/80 shadow-2xl transition-transform hover:scale-[1.01]">
              <Image
                src={posterSrc}
                alt="Inheritance Builders Bootcamp event flyer"
                width={620}
                height={775}
                className="h-full w-full object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex flex-wrap gap-2">
                  {programPillars.map((pillar) => (
                    <span
                      key={pillar}
                      className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md"
                    >
                      {pillar}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="inheritance" className="relative overflow-hidden px-6 py-32 sm:py-48">
        <div className="mx-auto grid max-w-7xl gap-20 lg:grid-cols-2 lg:items-start">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-jpv-green/80">The Vision</p>
              <h2 className="text-4xl font-black text-white sm:text-5xl lg:text-6xl leading-[1.1]">
                Inheritance is More Than Money
              </h2>
            </div>
            <p className="text-xl leading-relaxed text-jpv-gray-300">
              In Scripture, the word <span className="text-jpv-green font-bold">nachalah</span> speaks to legacy,
              stewardship, faith, and provision. This gathering is about building what lasts—strengthening families, communities, and generations.
            </p>

            <div className="group relative rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/40 p-8 transition-colors hover:border-jpv-green/20">
              <div className="absolute -left-px top-8 h-8 w-1 bg-jpv-green shadow-jpv-glow" />
              <h3 className="text-2xl font-bold text-white">Business & Property Reframed</h3>
              <p className="mt-4 text-jpv-gray-400 leading-relaxed">
                Tools, not the goal. We focus on using them wisely to create stability and long-term legacy, aligned with faith, integrity, and service.
              </p>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-jpv-gray-800 bg-jpv-bg-dark/20 p-8 backdrop-blur-sm">
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">What to Expect</h3>
              <ul className="mt-8 space-y-5">
                {bootcampHighlights.map((item) => (
                  <li key={item} className="flex items-start gap-4 text-jpv-gray-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jpv-green/10 text-jpv-green">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-jpv-gray-800 bg-jpv-bg-dark/20 p-8 backdrop-blur-sm">
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">Who it&apos;s for</h3>
              <ul className="mt-8 space-y-5">
                {whoItsFor.map((item) => (
                  <li key={item} className="flex items-start gap-4 text-jpv-gray-300">
                    <span className="flex h-1.5 w-1.5 shrink-0 translate-y-2 rounded-full bg-jpv-green shadow-jpv-glow" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-jpv-gray-700/40 bg-jpv-bg-dark/60 px-6 py-32 sm:py-48 overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 relative z-10">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-jpv-green/80">The Mission</p>
              <h2 className="text-4xl font-black text-white sm:text-5xl lg:text-6xl leading-[1.1]">Why This Matters</h2>
            </div>
            <div className="grid gap-6">
              {whyMatters.map((item) => (
                <div key={item} className="flex gap-5 items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-jpv-bg-dark border border-jpv-gray-700 font-black text-jpv-green">
                    0{whyMatters.indexOf(item) + 1}
                  </div>
                  <p className="text-lg text-jpv-gray-300 leading-relaxed font-medium pt-1">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative rounded-[40px] border border-jpv-gray-700/50 bg-jpv-bg-dark/90 p-10 shadow-3xl">
            <div className="space-y-8">
              <div className="inline-block rounded-lg bg-jpv-green px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                Kingdom Impact
              </div>
              <ul className="space-y-6">
                {impactPoints.map((item) => (
                  <li key={item} className="flex items-start gap-5">
                    <svg className="h-6 w-6 shrink-0 text-jpv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="text-lg font-bold text-jpv-gray-200">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-6 border-t border-jpv-gray-800">
                <p className="text-jpv-gray-400 italic">
                  &ldquo;We believe God gives resources not just to accumulate, but to restore, uplift, and empower others.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="speakers" className="px-6 py-32 sm:py-48">
        <div className="mx-auto max-w-7xl space-y-20">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-jpv-green/80">Voices of Experience</p>
            <h2 className="text-4xl font-black text-white sm:text-5xl lg:text-6xl leading-[1.1]">Speakers & Testimonies</h2>
            <p className="text-xl text-jpv-gray-400">
              Expect real-world insights, stories of transformation, and practical steps you can implement immediately.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <div className="grid gap-6">
              <div className="overflow-hidden rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 aspect-video relative group">
                <Image
                  src={hallInteriorOne}
                  alt="Emmanuel Centre hall interior"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-6 left-6 text-white font-bold uppercase tracking-widest text-sm">Main Auditorium</p>
              </div>
              <div className="overflow-hidden rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 aspect-[21/9] relative group">
                <Image
                  src={hallInteriorTwo}
                  alt="Emmanuel Centre auditorium"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-6 left-6 text-white font-bold uppercase tracking-widest text-sm">Inspirational Environment</p>
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-8 lg:pl-10">
              <div className="space-y-6">
                {speakerNotes.map((item) => (
                  <div key={item} className="flex items-center gap-5">
                    <div className="h-2 w-2 rounded-full bg-jpv-green shadow-jpv-glow" />
                    <span className="text-xl font-bold text-white">{item}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-jpv-green/20 bg-jpv-green/5 p-6 animate-pulse">
                <p className="text-jpv-green font-bold uppercase tracking-widest text-sm">Live Lineup</p>
                <p className="mt-2 text-jpv-gray-300 font-medium">Final speaker list being curated for maximum impact. Stay tuned.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="exhibitors" className="relative bg-jpv-bg-dark/80 px-6 py-32 sm:py-48 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-jpv-green/5 -skew-x-12 translate-x-1/4" />
        <div className="mx-auto grid max-w-7xl items-center gap-20 lg:grid-cols-2 relative z-10">
          <div className="space-y-10">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-jpv-green/80">Collaborate</p>
              <h2 className="text-4xl font-black text-white sm:text-5xl lg:text-6xl leading-[1.1]">Exhibitor Tables</h2>
            </div>
            <p className="text-xl text-jpv-gray-300 leading-relaxed">
              Engage directly with founders, investors, and leaders who are building for the long term with clarity, integrity, and a heart to serve others.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-black/40 border border-jpv-gray-800">
                <svg className="h-6 w-6 shrink-0 text-jpv-green mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div>
                  <h4 className="font-bold text-white">Strategic Layout</h4>
                  <p className="text-jpv-gray-400 mt-1">Accommodates up to 23 professional exhibition tables in the main upper hall.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href={phoneHref}
                  className="rounded-full bg-jpv-green px-10 py-5 text-lg font-black text-black shadow-jpv-glow transition-all hover:scale-[1.02] hover:bg-jpv-green-hover text-center"
                >
                  Book Your Table
                </a>
                <a
                  href={hallLayoutHref}
                  download
                  className="rounded-full border border-jpv-gray-700 px-10 py-5 text-lg font-bold text-white transition-all hover:border-jpv-green hover:bg-white/5 text-center"
                >
                  Hall Layout (PDF)
                </a>
              </div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-4 rounded-[40px] bg-jpv-green/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="overflow-hidden rounded-[40px] border border-jpv-gray-700/50 shadow-2xl relative">
              <Image
                src={venueEntrance}
                alt="Entrance of the Emmanuel Centre in London"
                width={800}
                height={600}
                className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              />
              <div className="absolute bottom-10 left-10">
                <p className="bg-black/80 backdrop-blur px-4 py-2 rounded-lg text-white font-bold text-sm tracking-widest border border-jpv-gray-700">EMMANUEL CENTRE, LONDON</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tickets" className="px-6 py-32 sm:py-48">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[60px] bg-jpv-green p-12 lg:p-24">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-black/5 -skew-x-12 translate-x-1/2" />

            <div className="relative z-10 grid gap-16 lg:grid-cols-2 lg:items-center">
              <div className="space-y-10 text-black">
                <div className="space-y-4">
                  <p className="text-sm font-black uppercase tracking-[0.4em] text-black/60">Final Call</p>
                  <h2 className="text-5xl font-black sm:text-7xl leading-[1.1]">Register Today</h2>
                  <p className="text-xl font-bold max-w-md">Limited in-person capacity. Secure your place at the heart of London.</p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-black/50">Location</p>
                    <p className="text-lg font-black leading-tight">Emmanuel Centre<br />9-23 Marsham St, SW1P</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-black/50">Schedule</p>
                    <p className="text-lg font-black leading-tight">10:30 AM Registration<br />11 AM - 4 PM Program</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <a
                    href={phoneHref}
                    className="rounded-full bg-black px-10 py-5 text-xl font-black text-jpv-green shadow-2xl transition-all hover:scale-105 active:scale-95 text-center"
                  >
                    {phoneDisplay}
                  </a>
                  <a
                    href={flyerHref}
                    download
                    className="rounded-full border-[3px] border-black px-10 py-5 text-xl font-black text-black transition-all hover:bg-black/10 text-center"
                  >
                    Event PDF
                  </a>
                </div>
              </div>

              <div className="rounded-[40px] bg-black/10 p-10 backdrop-blur-sm border border-black/10">
                <blockquote className="space-y-8">
                  <div className="text-3xl font-black text-black leading-tight">
                    &ldquo;Inheritance isn&apos;t just what we leave behind. It&apos;s what the next generation, and those God sends to us, walk into.&rdquo;
                  </div>
                  <footer className="pt-8 border-t border-black/10">
                    <p className="text-lg font-bold text-black/70 italic">Join us to build wisdom, provision, and legacy with faith at the center.</p>
                  </footer>
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
