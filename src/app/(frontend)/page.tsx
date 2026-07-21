'use client'

import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  Sun,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useState, type FormEvent } from 'react'

import SponsoredPayItForward from '@/components/sponsored-pay-it-forward'
import { JpvBrandLockup } from '@/components/brand/JpvBrandLockup'
import { AccessibleDialog } from '@/components/ui/AccessibleDialog'
import { landingSans, landingSerif } from '@/fonts'

import styles from './landing.module.scss'

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Community', href: '#community' },
  { label: 'Resources', href: '#how-it-works' },
  { label: 'Success Stories', href: '#success-stories' },
  { label: 'Partners', href: '/partners' },
  { label: 'About', href: '#about' },
] as const

const benefitItems = [
  { label: 'Monthly and annual plans', icon: Check },
  { label: 'Instant access when you join', icon: Check },
  { label: 'Live training', icon: Check },
  { label: 'Hands-on approach', icon: Check },
  { label: 'Private live events', icon: Check },
  { label: 'Clear membership options', icon: Check },
  { label: 'Video curriculum', icon: Check },
]

const programmeCards = [
  {
    title: 'Structured learning',
    description: 'Weekly teaching and protected programme resources.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-20-28-15.jpg',
  },
  {
    title: 'Practical application',
    description: 'Property scenarios, exercises, and accountable next steps.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg',
  },
  {
    title: 'Live experiences',
    description: 'In-person events that connect learning with action.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg',
  },
  {
    title: 'Community support',
    description: 'Shared purpose, practical discussion, and encouragement.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-22-10-32.jpg',
  },
] as const

const journeyCards = [
  {
    number: '01',
    title: 'Learn',
    description: 'Access structured video lessons, practical templates, and seven weekly Friday Zoom sessions.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-20-28-15.jpg',
    items: ['Weekly live online training', 'Replays available for later review', 'Interactive questions and answers'],
  },
  {
    number: '02',
    title: 'Apply',
    description: 'Analyse investment opportunities, complete practical exercises, and receive expert feedback.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-22-09-11.jpg',
    items: ['Full-day live event', 'Real property scenarios', 'Practical expert feedback'],
  },
  {
    number: '03',
    title: 'Build',
    description: 'Move from knowledge to action with support around property, finance, renovation, and adding value.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg',
    items: ['Guidance for each next step', 'Support through practical decisions', 'A path towards a portfolio'],
  },
  {
    number: '04',
    title: 'Belong',
    description: 'Continue the journey with people committed to excellence, accountability, and shared purpose.',
    image: '/events/inheritance-builders/PHOTO-2026-01-27-22-10-32.jpg',
    items: ['Member discussions', 'Programme questions and answers', 'Protected resources'],
  },
] as const

const faqItems = [
  {
    question: 'How do payments work?',
    answer:
      'Card payments are processed through Stripe. The available monthly and annual options are shown in the pricing section.',
  },
  {
    question: 'What does the JPV Bootcamp Membership include?',
    answer:
      'The JPV Bootcamp Membership provides access to the current programme, protected resources, and community features available in the member portal.',
  },
  {
    question: 'Where can I ask a question?',
    answer: 'Use the support form at the bottom of this page.',
  },
] as const

const pricingPlans = [
  {
    name: 'Monthly',
    contractLabel: 'JPV Bootcamp Membership — Monthly',
    contractPrice: '£80/month',
    price: '£80',
    suffix: 'per month',
    description: 'No minimum commitment',
    features: [
      'Renews monthly until cancelled',
      'Cancellation takes effect at the end of the paid month',
      'Programme, resources, and community access',
      'Personal voucher and pay-it-forward codes supported',
    ],
    ctaLabel: 'Choose monthly membership',
    ctaHref: "/upgrade",
    featured: false,
  },
  {
    name: 'Annual',
    contractLabel: 'JPV Bootcamp Membership — Annual',
    contractPrice: '£800/year',
    price: '£800',
    suffix: 'paid upfront for 12 months',
    description: 'Two months included at no extra cost',
    features: [
      'Automatically renews annually unless cancelled',
      'Programme, resources, and community access',
      'Personal voucher and pay-it-forward codes supported',
      'One clear annual payment',
    ],
    ctaLabel: 'Choose annual membership',
    ctaHref: "/upgrade",
    featured: true,
  },
] as const

const onboardingSteps = [
  {
    title: 'Choose your membership',
    description: 'Select monthly or annual billing through the secure membership checkout.',
  },
  {
    title: 'Verify your account',
    description: 'Follow the secure email steps to confirm your address and set your password.',
  },
  {
    title: 'Enter the member portal',
    description: 'Continue into your available programme, resources, community, and billing tools.',
  },
] as const

const inputClassName =
  'mt-2 w-full rounded-xl border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink placeholder:text-jpv-muted/70 transition focus:border-jpv-green-deep focus:outline-none focus:ring-2 focus:ring-jpv-green/25 disabled:cursor-not-allowed disabled:opacity-60'

export default function HomePage() {
  const signInHref = '/portal?mode=login'
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false)
  const [supportName, setSupportName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [supportQuestion, setSupportQuestion] = useState('')
  const [supportStatus, setSupportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [supportError, setSupportError] = useState<string | null>(null)
  const isSupportSending = supportStatus === "sending"

  async function handleSupportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSupportSending) return

    setSupportStatus('sending')
    setSupportError(null)

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supportName.trim(),
          email: supportEmail.trim(),
          question: supportQuestion.trim(),
          source: 'jpvbootcamp.com footer support modal',
          page: window.location.pathname || '/',
        }),
      })

      type SupportResponse = { ok?: boolean; accepted?: boolean }
      let payload: SupportResponse | null = null
      try {
        payload = (await response.json()) as SupportResponse
      } catch {
        payload = null
      }

      if (response.ok && payload?.ok && payload.accepted) {
        setSupportStatus('success')
        setSupportName('')
        setSupportEmail('')
        setSupportQuestion('')
      } else {
        setSupportStatus('error')
        setSupportError('We could not save your request. Please try again shortly.')
      }
    } catch {
      setSupportStatus('error')
      setSupportError('We could not save your request. Please try again shortly.')
    }
  }

  function handleSupportCancel() {
    if (
      (supportName || supportEmail || supportQuestion) &&
      !window.confirm('Close the support form and discard what you have written?')
    ) {
      return
    }

    setIsSupportOpen(false)
    setSupportName('')
    setSupportEmail('')
    setSupportQuestion('')
    setSupportStatus('idle')
    setSupportError(null)
  }

  function openSupportForm() {
    setIsSupportOpen(true)
    setIsHowItWorksOpen(false)
    setSupportStatus('idle')
    setSupportError(null)
  }

  return (
    <main className='min-h-screen overflow-x-hidden bg-jpv-canvas text-jpv-ink'>
      <a
        className='fixed left-4 top-4 z-[70] -translate-y-24 rounded-full bg-jpv-ink px-4 py-2 text-sm font-semibold text-jpv-canvas transition focus:translate-y-0'
        href='#main-content'
      >
        Skip to content
      </a>

      <header className='fixed inset-x-0 top-0 z-50 border-b border-jpv-border/80 bg-jpv-canvas/95'>
        <div className='mx-auto flex min-h-20 max-w-[80rem] items-center justify-between gap-6 px-5 py-3 md:px-8'>
          <JpvBrandLockup href='#home' priority />

          <nav aria-label='Main navigation' className='hidden items-center gap-6 xl:flex'>
            {navLinks.map((item) => (
              <a
                className='text-sm font-medium text-jpv-muted transition hover:text-jpv-ink'
                href={item.href}
                key={item.label}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className='hidden items-center gap-2 md:flex'>
            <a className='jpv-button-accent' href='#support'>
              Support
            </a>
            <a className='jpv-button-secondary' href={signInHref}>
              Sign in
            </a>
            <a className='jpv-button-primary' href='#pricing'>
              Join
            </a>
          </div>

          <button
            aria-controls='mobile-navigation'
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? 'Close navigation' : 'Open navigation'}
            className='inline-flex h-11 w-11 items-center justify-center rounded-full border border-jpv-border text-jpv-ink transition hover:bg-jpv-surface md:hidden'
            onClick={() => setIsMobileNavOpen((open) => !open)}
            type='button'
          >
            {isMobileNavOpen ? <X aria-hidden='true' size={20} /> : <Menu aria-hidden='true' size={20} />}
          </button>
        </div>

        {isMobileNavOpen ? (
          <div className='border-t border-jpv-border bg-jpv-canvas px-5 py-5 md:hidden' id='mobile-navigation'>
            <nav aria-label='Mobile navigation' className='mx-auto grid max-w-[80rem] gap-1'>
              {navLinks.map((item) => (
                <a
                  className='rounded-xl px-3 py-3 text-sm font-semibold text-jpv-ink transition hover:bg-jpv-surface'
                  href={item.href}
                  key={item.label}
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className='mt-3 grid grid-cols-3 gap-2 border-t border-jpv-border pt-4'>
                <a className='jpv-button-accent px-3' href='#support' onClick={() => setIsMobileNavOpen(false)}>
                  Support
                </a>
                <a className='jpv-button-secondary px-3' href={signInHref} onClick={() => setIsMobileNavOpen(false)}>
                  Sign in
                </a>
                <a className='jpv-button-primary px-3' href='#pricing' onClick={() => setIsMobileNavOpen(false)}>
                  Join
                </a>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <div id='main-content'>
        <section className='scroll-mt-24 px-5 pb-20 pt-32 sm:pb-24 sm:pt-40 md:px-8' id='home'>
          <div className='mx-auto grid max-w-[80rem] items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20'>
            <div>
              <p className='jpv-eyebrow'>For those called beyond the ordinary</p>
              <h1 className='mt-5 max-w-[13ch] text-balance text-5xl font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl xl:text-[5.5rem]'>
                Choose purpose over comfort.
              </h1>
              <p className='mt-7 max-w-2xl text-pretty text-xl font-semibold leading-8 text-jpv-green-deep sm:text-2xl'>
                Transforming Lives. Equipping Purpose. Inspiring Freedom.
              </p>
              <p className='mt-4 max-w-xl text-pretty text-base leading-7 text-jpv-muted sm:text-lg'>
                Invest Wisely, Steward Faithfully, Bless Generously. A premium property education platform designed for aspiring and experienced investors who want to build lasting wealth through wisdom, strategy, and stewardship.
              </p>
              <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
                <a className='jpv-button-primary min-h-12 px-7' href='#pricing'>
                  Become a Member
                  <ArrowRight aria-hidden='true' size={18} />
                </a>
                <button
                  className='jpv-button-secondary min-h-12 px-7'
                  onClick={() => setIsHowItWorksOpen(true)}
                  type='button'
                >
                  See how it works
                </button>
              </div>
              <p className='mt-4 text-sm font-medium text-jpv-muted'>Plans start at £80 per month, or £800 paid annually.</p>
            </div>

            <div className='relative mx-auto w-full max-w-xl lg:mx-0'>
              <div aria-hidden='true' className='absolute -right-10 -top-10 h-48 w-48 rounded-full bg-jpv-sunshine/35 blur-3xl' />
              <div className='relative overflow-hidden rounded-[2rem] border border-jpv-border bg-jpv-surface p-6 shadow-[var(--jpv-shadow)] sm:p-8'>
                <div className='flex items-center justify-between gap-4 border-b border-jpv-border pb-5'>
                  <div>
                    <p className='jpv-eyebrow'>Your practical path</p>
                    <p className='mt-2 text-xl font-bold'>Learn. Apply. Build.</p>
                  </div>
                  <span className='flex h-12 w-12 items-center justify-center rounded-full bg-jpv-green text-jpv-ink'>
                    <Sun aria-hidden='true' size={24} />
                  </span>
                </div>
                <ol className='mt-7 space-y-6'>
                  {['Structured weekly teaching', 'Hands-on live event experience', 'Community-backed portfolio building'].map((item, index) => (
                    <li className='grid grid-cols-[2.5rem_1fr] items-start gap-4' key={item}>
                      <span className='flex h-10 w-10 items-center justify-center rounded-full bg-jpv-ink text-sm font-bold text-jpv-canvas'>
                        {index + 1}
                      </span>
                      <div className='border-b border-jpv-border pb-6 last:border-0'>
                        <p className='font-semibold'>{item}</p>
                        <p className='mt-1 text-sm leading-6 text-jpv-muted'>Guidance, practical action, and accountable next steps.</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section aria-label='Membership benefits' className='border-y border-jpv-border bg-jpv-surface py-4'>
          <div className='mx-auto flex max-w-[80rem] snap-x gap-7 overflow-x-auto px-5 md:px-8' tabIndex={0}>
            {benefitItems.map((item) => {
              const Icon = item.icon
              return (
                <div className='flex shrink-0 snap-start items-center gap-2.5 py-2 text-sm font-semibold text-jpv-ink' key={item.label}>
                  <Icon aria-hidden='true' className='text-jpv-green-deep' size={17} />
                  {item.label}
                </div>
              )
            })}
          </div>
        </section>

        <section className='px-5 py-20 sm:py-28 md:px-8' id='who'>
          <div className='mx-auto grid max-w-[72rem] gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20'>
            <div>
              <p className='jpv-eyebrow'>Who is JPV Bootcamp for?</p>
              <h2 className='mt-4 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                Property education for a purpose bigger than personal success.
              </h2>
            </div>
            <div className='space-y-6 text-pretty text-base leading-8 text-jpv-muted sm:text-lg'>
              <p>
                We are not just another property training organisation whose sole aim is to provide knowledge and help people achieve financial freedom and build wealth.
              </p>
              <p>
                Yes, we want you to gain the knowledge, skills, and confidence to succeed in property investment. But our vision goes far beyond personal success. We want to see communities built within the Body of Christ, where believers support one another, align themselves with the will of God, and work together to accomplish investments and transformational projects that will benefit their families, communities, nations, and generations to come.
              </p>
              <p className='font-semibold text-jpv-ink'>
                This is why we created JPV Bootcamp: to see freedom established within the Body of Christ, so believers can fulfil God&apos;s will, walk in their unique calling, and become faithful stewards of the resources entrusted to them.
              </p>
            </div>
          </div>
        </section>

        <section className='scroll-mt-24 bg-jpv-ink px-5 py-20 text-jpv-canvas sm:py-28 md:px-8' id='how-it-works'>
          <div className='mx-auto max-w-[80rem]'>
            <div className='max-w-3xl'>
              <p className='jpv-eyebrow text-jpv-canvas/80'>How JPV Bootcamp works</p>
              <h2 className='mt-4 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                Everything you need to understand property investment, in one place.
              </h2>
              <p className='mt-5 max-w-2xl text-pretty text-lg leading-8 text-jpv-canvas/70'>
                Structured teaching, practical application, and ongoing support stay connected throughout your journey.
              </p>
              <p className='mt-4 max-w-2xl text-sm leading-6 text-jpv-canvas/60'>
                Final module titles and learning-outcome wording are pending client approval.
              </p>
            </div>

            <div className='mt-14 grid gap-px overflow-hidden rounded-[2rem] bg-jpv-canvas/15 lg:grid-cols-3'>
              <article className='bg-jpv-ink p-7 sm:p-9'>
                <span className='text-sm font-bold text-jpv-canvas/60'>01</span>
                <h3 className='mt-5 text-3xl font-bold'>Learn</h3>
                <p className='mt-4 leading-7 text-jpv-canvas/70'>Access structured video lessons, practical templates, and seven weekly Friday Zoom sessions.</p>
                <ul className='mt-6 space-y-3 text-sm leading-6 text-jpv-canvas/85'>
                  {['Over one hour of online training every Friday at 7:00pm', 'Replay available for later review', 'Interactive questions and answers after each session'].map((item) => (
                    <li className='flex gap-3' key={item}><Check aria-hidden='true' className='mt-1 shrink-0 text-jpv-green' size={16} />{item}</li>
                  ))}
                </ul>
              </article>

              <article className='bg-jpv-sunshine p-7 text-jpv-ink sm:p-9'>
                <span className='text-sm font-bold text-jpv-green-deep'>02</span>
                <h3 className='mt-5 text-3xl font-bold'>Apply at the live event</h3>
                <p className='mt-4 leading-7 text-jpv-ink/75'>Analyse investment opportunities, complete practical exercises, meet professionals, and receive expert feedback.</p>
                <ul className='mt-6 space-y-3 text-sm leading-6'>
                  {['Full-day event in London with lunch included', 'Real property scenarios to analyse', 'Meet fellow students and potential JV partners', 'Event ticket included in membership'].map((item) => (
                    <li className='flex gap-3' key={item}><Check aria-hidden='true' className='mt-1 shrink-0 text-jpv-green-deep' size={16} />{item}</li>
                  ))}
                </ul>
              </article>

              <article className='bg-jpv-green p-7 text-jpv-ink sm:p-9'>
                <span className='text-sm font-bold text-jpv-green-deep'>03</span>
                <h3 className='mt-5 text-3xl font-bold'>Build</h3>
                <p className='mt-4 leading-7 text-jpv-ink/75'>Purchase properties, grow your portfolio, and build long-term financial freedom with an engaged community.</p>
                <ul className='mt-6 space-y-3 text-sm leading-6'>
                  {['Help to establish your company', 'Guidance around property purchase and finance', 'Support through renovation and adding value', 'A practical path toward building portfolios'].map((item) => (
                    <li className='flex gap-3' key={item}><Check aria-hidden='true' className='mt-1 shrink-0 text-jpv-green-deep' size={16} />{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className='scroll-mt-24 px-5 py-20 sm:py-28 md:px-8' id='community'>
          <div className='mx-auto grid max-w-[80rem] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20'>
            <div className='relative overflow-hidden rounded-[2rem] bg-jpv-surface p-3 shadow-[var(--jpv-shadow)]'>
              <Image
                alt='A large live learning event in a bright auditorium'
                className='aspect-[4/3] w-full rounded-[1.45rem] object-cover'
                height={900}
                src='/events/inheritance-builders/PHOTO-2026-01-27-22-09-01.jpg'
                width={1200}
              />
              <div className='absolute inset-x-7 bottom-7 rounded-2xl bg-jpv-canvas p-5 shadow-lg'>
                <p className='text-sm font-bold'>Learning is stronger in community.</p>
                <p className='mt-1 text-sm leading-6 text-jpv-muted'>Training, practical discussion, and shared purpose stay connected.</p>
              </div>
            </div>

            <div>
              <p className='jpv-eyebrow'>Community</p>
              <h2 className='mt-4 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>
                You Don&apos;t Have To Build Alone.
              </h2>
              <p className='mt-5 text-pretty text-lg leading-8 text-jpv-muted'>
                Join a community committed to excellence, accountability, and growth. Follow your training content, join available discussions, ask practical questions, and learn alongside other students and members.
              </p>
              <div className='mt-8 grid gap-4 sm:grid-cols-2'>
                {['Available member discussions', 'Programme questions and answers', 'Shared practical learning', 'Direct access to protected resources'].map((item) => (
                  <div className='flex items-center gap-3 border-b border-jpv-border pb-4 font-semibold' key={item}>
                    <span className='flex h-8 w-8 items-center justify-center rounded-full bg-jpv-green/20 text-jpv-green-deep'><Check aria-hidden='true' size={16} /></span>
                    {item}
                  </div>
                ))}
              </div>
              <div className='mt-8 flex flex-wrap gap-3'>
                <a className='jpv-button-primary' href='#pricing'>Become a Member</a>
                <button className='jpv-button-secondary' onClick={() => setIsHowItWorksOpen(true)} type='button'>How onboarding works</button>
              </div>
            </div>
          </div>
        </section>

        <section className='scroll-mt-24 bg-jpv-surface px-5 py-20 sm:py-28 md:px-8' id='about'>
          <div className='mx-auto max-w-[72rem]'>
            <div className='grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20'>
              <div>
                <p className='jpv-eyebrow'>Meet your teachers</p>
                <h2 className='mt-4 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>Guidance from people who understand the journey.</h2>
              </div>
              <div className='grid gap-px overflow-hidden rounded-[2rem] bg-jpv-border sm:grid-cols-3'>
                {['Athina Amadi', 'Koprinka Aksaray', 'Guest Speakers'].map((name) => (
                  <article className='bg-jpv-canvas p-6' key={name}>
                    <div aria-hidden='true' className='flex h-12 w-12 items-center justify-center rounded-full bg-jpv-green text-lg font-bold text-jpv-ink'>{name.charAt(0)}</div>
                    <h3 className='mt-5 text-lg font-bold'>{name}</h3>
                    <p className='mt-2 text-sm leading-6 text-jpv-muted'>More information will be added when approved content is available.</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className='scroll-mt-24 px-5 py-20 sm:py-28 md:px-8' id='success-stories'>
          <div className='mx-auto max-w-[72rem] rounded-[2rem] border border-jpv-border bg-jpv-canvas p-8 text-center shadow-[var(--jpv-shadow)] sm:p-12'>
            <p className='jpv-eyebrow'>Success stories</p>
            <h2 className='mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl'>Real stories will be shared here.</h2>
            <p className='mx-auto mt-4 max-w-2xl text-pretty leading-7 text-jpv-muted'>Client-approved member stories and testimonials are still being prepared. We will not fill this space with invented claims.</p>
          </div>
        </section>

        <section className='scroll-mt-24 bg-jpv-surface px-5 py-20 sm:py-28 md:px-8' id='pricing'>
          <div className='mx-auto max-w-[72rem]'>
            <div className='mx-auto max-w-3xl text-center'>
              <p className='jpv-eyebrow'>Choose your plan</p>
              <h2 className='mt-4 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl'>Become a JPV Bootcamp Member.</h2>
              <p className='mt-5 text-lg leading-8 text-jpv-muted'>The same membership and access, with the billing rhythm that works for you.</p>
            </div>

            <div className='mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2'>
              {pricingPlans.map((plan) => (
                <article
                  aria-label={plan.contractLabel}
                  className={`relative flex flex-col rounded-[2rem] border p-7 sm:p-9 ${plan.featured ? 'border-jpv-ink bg-jpv-ink text-jpv-canvas' : 'border-jpv-border bg-jpv-canvas text-jpv-ink'}`}
                  data-contract-price={plan.contractPrice}
                  id={plan.name === 'Monthly' ? 'pricing-monthly' : 'pricing-annual'}
                  key={plan.name}
                >
                  {plan.featured ? <span className='absolute right-6 top-0 -translate-y-1/2 rounded-full bg-jpv-sunshine px-4 py-1.5 text-xs font-bold text-jpv-ink'>Best value</span> : null}
                  <p className={`text-sm font-bold uppercase tracking-[0.12em] ${plan.featured ? 'text-jpv-canvas/80' : 'text-jpv-green-deep'}`}>{plan.name}</p>
                  <div className='mt-4 flex items-end gap-3'><span className='text-5xl font-bold tracking-tight'>{plan.price}</span><span className={`pb-1 text-sm ${plan.featured ? 'text-jpv-canvas/65' : 'text-jpv-muted'}`}>{plan.suffix}</span></div>
                  <p className={`mt-3 text-sm font-semibold ${plan.featured ? 'text-jpv-sunshine' : 'text-jpv-green-deep'}`}>{plan.description}</p>
                  <ul className='mt-7 flex-1 space-y-4'>
                    {plan.features.map((feature) => (
                      <li className='flex gap-3 text-sm leading-6' key={feature}><Check aria-hidden='true' className={`mt-1 shrink-0 ${plan.featured ? 'text-jpv-green' : 'text-jpv-green-deep'}`} size={16} />{feature}</li>
                    ))}
                  </ul>
                  <a className={`mt-8 min-h-12 ${plan.featured ? 'jpv-button-primary' : 'jpv-button-secondary border-jpv-ink'}`} href={plan.ctaHref}>{plan.ctaLabel}<ArrowRight aria-hidden='true' size={18} /></a>
                </article>
              ))}
            </div>

            <p className='mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-jpv-muted'>Checkout requires email, telephone number, a payment method, and recurring-payment acknowledgement. Plan changes take effect according to the current billing terms.</p>
          </div>
        </section>

        <section className='scroll-mt-24 px-5 py-20 sm:py-28 md:px-8' id='support'>
          <div className='mx-auto max-w-[72rem]'>
            <div className='rounded-[2rem] bg-jpv-ink p-7 text-jpv-canvas sm:p-10'>
              <div className='grid items-center gap-8 lg:grid-cols-[0.7fr_1.3fr]'>
                <div>
                  <p className='jpv-eyebrow text-jpv-canvas/80'>Support and pay it forward</p>
                  <h2 className='mt-4 text-3xl font-bold tracking-tight sm:text-4xl'>Help make access possible.</h2>
                  <p className='mt-4 leading-7 text-jpv-canvas/70'>Use the existing JPV support and pay-it-forward path. Questions about your account can be sent through the support form.</p>
                  <div className='mt-6 flex flex-wrap gap-3'>
                    <button className='jpv-button-primary' onClick={openSupportForm} type='button'>Ask for support</button>
                    <a className='jpv-button-secondary border-jpv-canvas/30 text-jpv-canvas hover:bg-jpv-canvas/10' href='/sponsored'>Sponsored access</a>
                  </div>
                </div>
                <div className='rounded-jpv-panel bg-jpv-canvas p-4 text-jpv-ink sm:p-6'><SponsoredPayItForward /></div>
              </div>
            </div>
          </div>
        </section>

        <section className='scroll-mt-24 bg-jpv-surface px-5 py-20 sm:py-28 md:px-8' id='faq'>
          <div className='mx-auto max-w-3xl'>
            <p className='jpv-eyebrow text-center'>Questions</p>
            <h2 className='mt-4 text-center text-4xl font-bold tracking-tight sm:text-5xl'>Frequently Asked Questions.</h2>
            <div className='mt-10 overflow-hidden rounded-2xl border border-jpv-border bg-jpv-canvas'>
              {faqItems.map((item) => (
                <details className='group border-b border-jpv-border last:border-0' key={item.question}>
                  <summary className='flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 text-left font-semibold sm:px-6'>
                    {item.question}
                    <ChevronDown aria-hidden='true' className='shrink-0 transition-transform group-open:rotate-180' size={19} />
                  </summary>
                  <p className='max-w-2xl px-5 pb-6 text-sm leading-7 text-jpv-muted sm:px-6'>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className='border-t border-jpv-border bg-jpv-canvas px-5 py-10 md:px-8'>
        <div className='mx-auto flex max-w-[80rem] flex-col gap-8 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <JpvBrandLockup href='/' size='compact' />
            <p className='mt-2 text-xs text-jpv-muted'>© {new Date().getFullYear()} JPV. All rights reserved.</p>
          </div>
          <div className='flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium text-jpv-muted'>
            <a className='hover:text-jpv-ink' href="/terms">Terms</a>
            <a className='hover:text-jpv-ink' href="/privacy">Privacy</a>
            <a className='hover:text-jpv-ink' href='/cookies'>Cookies</a>
            <button className='hover:text-jpv-ink' onClick={openSupportForm} type='button'>Support</button>
            <a className='hover:text-jpv-ink' href='https://prochat.tools' rel='nofollow noopener noreferrer' target='_blank'>Powered by ProChat</a>
          </div>
        </div>
      </footer>

      <AccessibleDialog
        className='max-h-[calc(100vh-2.5rem)] w-[calc(100%-2.5rem)] max-w-xl overflow-y-auto'
        describedBy='how-it-works-desc'
        labelledBy='how-it-works-title'
        onClose={() => setIsHowItWorksOpen(false)}
        open={isHowItWorksOpen}
      >
          <section className='w-full rounded-[2rem] bg-jpv-canvas p-6 shadow-2xl sm:p-8'>
            <div className='flex items-start justify-between gap-5'>
              <div><p className='jpv-eyebrow'>Your next steps</p><h2 className='mt-3 text-2xl font-bold' id='how-it-works-title'>How onboarding works</h2><p className='mt-2 text-sm leading-6 text-jpv-muted' id='how-it-works-desc'>A quick overview of what happens after you choose a membership.</p></div>
              <button aria-label='Close onboarding steps' className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-jpv-border hover:bg-jpv-surface' onClick={() => setIsHowItWorksOpen(false)} type='button'><X aria-hidden='true' size={19} /></button>
            </div>
            <ol className='mt-7 space-y-4'>
              {onboardingSteps.map((step, index) => (
                <li className='grid grid-cols-[2.5rem_1fr] gap-4 rounded-2xl bg-jpv-surface p-4' key={step.title}><span className='flex h-10 w-10 items-center justify-center rounded-full bg-jpv-green text-sm font-bold'>{index + 1}</span><div><p className='font-bold'>{step.title}</p><p className='mt-1 text-sm leading-6 text-jpv-muted'>{step.description}</p></div></li>
              ))}
            </ol>
            <button className='jpv-button-secondary mt-7 w-full' onClick={() => setIsHowItWorksOpen(false)} type='button'>Close</button>
          </section>
      </AccessibleDialog>

      <AccessibleDialog
        className='max-h-[calc(100vh-2.5rem)] w-[calc(100%-2.5rem)] max-w-xl overflow-y-auto'
        describedBy='support-desc'
        labelledBy='support-title'
        onClose={handleSupportCancel}
        open={isSupportOpen}
      >
          <section className='w-full rounded-[2rem] bg-jpv-canvas p-6 shadow-2xl sm:p-8'>
            <div className='flex items-start justify-between gap-5'>
              <div><p className='jpv-eyebrow'>We are here to help</p><h2 className='mt-3 text-2xl font-bold' id='support-title'>Support</h2><p className='mt-2 text-sm leading-6 text-jpv-muted' id='support-desc'>Send your question to the JPV Bootcamp team.</p></div>
              <button aria-label='Close support form' className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-jpv-border hover:bg-jpv-surface' onClick={handleSupportCancel} type='button'><X aria-hidden='true' size={19} /></button>
            </div>

            {supportStatus !== 'idle' ? (
              <div aria-atomic='true' aria-live='polite' className={`mt-5 rounded-xl border px-4 py-3 text-sm ${supportStatus === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-jpv-border bg-jpv-surface text-jpv-ink'}`} role='status'>
                {supportStatus === 'success' ? 'Thanks. Your request has been saved for review.' : null}
                {supportStatus === 'error' ? supportError : null}
                {supportStatus === 'sending' ? 'Saving your request…' : null}
              </div>
            ) : null}

            <form className='mt-6 space-y-5' onSubmit={handleSupportSubmit}>
              <div><label className='text-sm font-semibold' htmlFor='support-name'>Name</label><input className={inputClassName} disabled={isSupportSending} id='support-name' onChange={(event) => { setSupportStatus('idle'); setSupportError(null); setSupportName(event.target.value) }} required type='text' value={supportName} /></div>
              <div><label className='text-sm font-semibold' htmlFor='support-email'>Email address</label><input autoComplete='email' className={inputClassName} disabled={isSupportSending} id='support-email' onChange={(event) => { setSupportStatus('idle'); setSupportError(null); setSupportEmail(event.target.value) }} required type='email' value={supportEmail} /></div>
              <div><label className='text-sm font-semibold' htmlFor='support-question'>How can we help?</label><textarea className={`${inputClassName} resize-y`} disabled={isSupportSending} id='support-question' onChange={(event) => { setSupportStatus('idle'); setSupportError(null); setSupportQuestion(event.target.value) }} required rows={5} value={supportQuestion} /></div>
              <div className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'><button className='jpv-button-secondary' onClick={handleSupportCancel} type='button'>Keep browsing</button><button className='jpv-button-primary' disabled={isSupportSending} type='submit'>{isSupportSending ? 'Sending question…' : 'Send question'}</button></div>
            </form>
          </section>
      </AccessibleDialog>
    </main>
  )
}
