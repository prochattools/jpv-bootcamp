import { GraduationCap, Settings, Users, Video } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AuthShell } from '@/components/auth/AuthShell'
import { MemberLoginForm } from '@/components/auth/MemberLoginForm'
import { MemberVerificationResendForm } from '@/components/auth/MemberVerificationResendForm'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getMemberCourseDashboard } from '@/lib/payloadCourse/memberPortal'
import { getPortalLoginBranding, type PortalLoginBranding } from '@/lib/portal/portalSettings'

type PortalSearchParams = {
  mode?: string | string[]
  next?: string | string[]
  redirect?: string | string[]
  verification?: string | string[]
  emailChange?: string | string[]
  loggedOut?: string | string[]
  registration?: string | string[]
}

type PortalDashboardPageProps = {
  searchParams?: Promise<PortalSearchParams>
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function portalNotice(params: PortalSearchParams | undefined): string | null {
  const verification = firstValue(params?.verification)
  const emailChange = firstValue(params?.emailChange)
  const loggedOut = firstValue(params?.loggedOut)
  const registration = firstValue(params?.registration)

  if (loggedOut === '1') return 'You have been signed out.'
  if (registration === 'disabled') {
    return 'Public registration now starts through JPV Bootcamp Membership Checkout.'
  }
  if (verification === 'success') return 'Your email address has been verified. You can now sign in.'
  if (verification === 'used') return 'This verification link has already been used. You can request another email below if needed.'
  if (verification === 'invalid') return 'This verification link is invalid or expired. You can request another email below.'
  if (emailChange === 'success') return 'Your sign-in email address was changed successfully. Use the new address when you sign in.'
  if (emailChange === 'invalid') return 'This email-change link is invalid or expired. Sign in with your current address to request another link.'
  return null
}

function PortalLoginMode({
  params,
  branding,
}: {
  params: PortalSearchParams | undefined
  branding: PortalLoginBranding
}) {
  const requestedDestination = firstValue(params?.next) ?? firstValue(params?.redirect)
  const notice = portalNotice(params)

  return (
    <AuthShell
      branding={{
        siteTitle: branding.siteTitle,
        logoUrl: branding.logoUrl,
        bannerTitle: branding.bannerTitle,
        bannerDescription: branding.bannerDescription,
        bannerTitleColor: branding.bannerTitleColor,
        bannerTextColor: branding.bannerTextColor,
        bannerBackgroundColor: branding.bannerBackgroundColor,
        formTitleColor: branding.formTitleColor,
        formTextColor: branding.formTextColor,
        formBackgroundColor: branding.formBackgroundColor,
      }}
      description={branding.formDescription}
      eyebrow='JPV Bootcamp member portal'
      footer={(
        <p className='text-sm text-jpv-muted'>
          Members and Payload administrators use this sign-in. Administrator accounts receive portal editing permissions automatically.
        </p>
      )}
      introActions={(
        <div className='flex flex-wrap gap-3'>
          <Link className='jpv-button-primary' href='/upgrade'>Choose membership</Link>
          <Link className='jpv-button-secondary' href='/forgot-password'>Forgot password</Link>
        </div>
      )}
      title={branding.formTitle}
    >
      <h2 className='text-xl font-bold'>Member or administrator sign in</h2>
      <p className='mt-2 text-sm leading-6 text-jpv-muted'>
        Checkout-created and administrator-created accounts must verify their email address before signing in. Resend verification below if needed.
      </p>
      {notice ? (
        <p className='jpv-notice mt-5 text-sm leading-6' role='status'>
          {notice}
        </p>
      ) : null}
      <MemberLoginForm
        requestedDestination={requestedDestination}
        submitBackgroundColor={branding.buttonColor}
        submitLabel={branding.buttonLabel}
        submitTextColor={branding.buttonLabelColor}
      />
      <MemberVerificationResendForm />
    </AuthShell>
  )
}

export default async function PortalDashboardPage({ searchParams }: PortalDashboardPageProps) {
  const params = await searchParams
  if (firstValue(params?.mode) === 'register') {
    return redirect('/upgrade')
  }
  if (firstValue(params?.mode) === 'login') {
    const branding = await getPortalLoginBranding()
    return <PortalLoginMode branding={branding} params={params} />
  }

  const { actor, payload } = await requirePortalAccess('/portal')

  const quickLinks = [
    { href: '/portal/courses', label: 'Courses', Icon: GraduationCap },
    { href: '/portal/live-sessions', label: 'Live', Icon: Video },
    { href: '/portal/community', label: 'Community', Icon: Users },
    { href: '/portal/account', label: 'Account', Icon: Settings },
  ]

  if (actor.kind === 'admin') {
    return (
      <div className='mx-auto max-w-5xl space-y-5 px-4 py-4'>
        <section>
          <p className='jpv-eyebrow'>JPV Bootcamp — Administrator</p>
          <h1 className='mt-2 text-2xl font-semibold tracking-tight text-jpv-ink'>Portal overview</h1>
          <p className='mt-1 text-sm text-jpv-muted'>You are viewing the member portal as a platform administrator. Admin Mode starts on, and you can turn it off or on from the top bar while you participate as a member.</p>
        </section>
        <section>
          <h2 className='mb-4 text-xs font-extrabold uppercase tracking-widest text-jpv-muted'>Quick links</h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
            {quickLinks.map(({ href, label, Icon }) => (
              <Link
                className='flex flex-col items-center gap-3 rounded-jpv-card border border-jpv-border bg-jpv-surface p-5 text-center transition hover:border-jpv-brand hover:bg-jpv-canvas hover:shadow-sm'
                href={href}
                key={href}
              >
                <Icon aria-hidden='true' className='h-6 w-6 text-jpv-brand' />
                <span className='text-sm font-semibold text-jpv-ink'>{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    )
  }

  const memberId = actor.memberId
  const memberEmail = actor.email
  const dashboard = await getMemberCourseDashboard(payload, memberId)
  const availableCourses = dashboard.courses.filter((course) => course.allowed)

  // Derive a friendly display name from the email prefix
  const emailPrefix = memberEmail.split('@')[0] ?? ''
  const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)

  // Stats derived from already-fetched data
  const enrolledCount = availableCourses.length
  const completedLessonsTotal = availableCourses.reduce(
    (sum, c) => sum + (c.completedLessonCount ?? 0),
    0,
  )
  const totalLessonsCount = availableCourses.reduce(
    (sum, c) => sum + (c.lessonCount ?? 0),
    0,
  )
  const overallPercent =
    totalLessonsCount > 0
      ? Math.round((completedLessonsTotal / totalLessonsCount) * 100)
      : null

  // Find the course that contains the continue lesson (for its progress bar)
  const continueCourse = dashboard.continueLesson
    ? (availableCourses.find((c) => c.slug === dashboard.continueLesson?.courseSlug) ?? null)
    : null

  // Today's date for the welcome section
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className='mx-auto max-w-5xl space-y-5 px-4 py-4'>

      {/* 1. Welcome section */}
      <section>
        <p className='jpv-eyebrow'>JPV Bootcamp</p>
        <h1 className='mt-2 text-2xl font-semibold tracking-tight text-jpv-ink'>
          Welcome back{displayName ? `, ${displayName}` : ''}
        </h1>
        <p className='mt-1 text-sm text-jpv-muted'>{todayLabel}</p>
      </section>

      {/* 2. Continue learning — primary CTA */}
      {dashboard.continueLesson ? (
        <section
          aria-label='Continue learning'
          className='rounded-jpv-panel border border-jpv-brand-deep bg-jpv-brand-deep p-5 shadow-jpv-card'
        >
          <p className='text-xs font-extrabold uppercase tracking-widest text-jpv-brand-bright'>
            Continue learning
          </p>
          <h2 className='mt-2 text-xl font-semibold text-jpv-canvas'>
            {dashboard.continueLesson.lessonTitle}
          </h2>
          <p className='mt-1 text-sm text-jpv-brand-bright'>
            {dashboard.continueLesson.courseTitle}
            {dashboard.continueLesson.estimatedDuration
              ? ` · ${dashboard.continueLesson.estimatedDuration}`
              : ''}
          </p>

          {continueCourse && continueCourse.progressPercent !== null ? (
            <div className='mt-4'>
              <div className='mb-1 flex items-center justify-between'>
                <span className='text-xs text-jpv-brand-bright opacity-70'>Course progress</span>
                <span className='text-xs font-semibold text-jpv-brand-bright'>
                  {continueCourse.progressPercent}%
                </span>
              </div>
              <div className='h-2 w-full overflow-hidden rounded-full bg-jpv-brand'>
                <div
                  className='h-full rounded-full bg-jpv-brand-bright transition-all'
                  style={{ width: `${continueCourse.progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {dashboard.continueLesson.courseSlug && dashboard.continueLesson.lessonSlug ? (
            <Link
              className='jpv-button-primary mt-5 inline-flex'
              href={`/portal/courses/${dashboard.continueLesson.courseSlug}/lessons/${dashboard.continueLesson.lessonSlug}`}
            >
              Continue lesson
            </Link>
          ) : null}
        </section>
      ) : (
        <section className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-5'>
          <p className='text-sm text-jpv-muted'>
            No lessons in progress yet.{' '}
            <Link
              className='font-semibold text-jpv-brand underline-offset-4 hover:underline'
              href='/portal/courses'
            >
              Browse your courses
            </Link>{' '}
            to get started.
          </p>
        </section>
      )}

      {/* 3. Quick stats row */}
      <section aria-label='Learning stats'>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
          <div className='rounded-xl bg-jpv-ink p-5 shadow-sm dark:bg-jpv-surface-strong'>
            <p className='text-xs font-semibold uppercase tracking-wider text-jpv-inverse-muted dark:text-jpv-brand'>
              Courses enrolled
            </p>
            <p className='mt-2 text-3xl font-bold text-jpv-canvas dark:text-jpv-ink'>{enrolledCount}</p>
          </div>
          <div className='rounded-xl bg-jpv-ink p-5 shadow-sm dark:bg-jpv-surface-strong'>
            <p className='text-xs font-semibold uppercase tracking-wider text-jpv-inverse-muted dark:text-jpv-brand'>
              Lessons completed
            </p>
            <p className='mt-2 text-3xl font-bold text-jpv-canvas dark:text-jpv-ink'>{completedLessonsTotal}</p>
            {totalLessonsCount > 0 ? (
              <p className='mt-1 text-xs text-jpv-inverse-muted dark:text-jpv-muted'>of {totalLessonsCount} total</p>
            ) : null}
          </div>
          <div className='rounded-xl bg-jpv-ink p-5 shadow-sm dark:bg-jpv-surface-strong'>
            <p className='text-xs font-semibold uppercase tracking-wider text-jpv-inverse-muted dark:text-jpv-brand'>
              Overall progress
            </p>
            <p className='mt-2 text-3xl font-bold text-jpv-canvas dark:text-jpv-ink'>
              {overallPercent !== null ? `${overallPercent}%` : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Navigation shortcuts */}
      <section aria-label='Quick links'>
        <h2 className='mb-4 text-xs font-extrabold uppercase tracking-widest text-jpv-muted'>
          Quick links
        </h2>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
          {quickLinks.map(({ href, label, Icon }) => (
            <Link
              className='flex flex-col items-center gap-3 rounded-jpv-card border border-jpv-border bg-jpv-surface p-5 text-center transition hover:border-jpv-brand hover:bg-jpv-canvas hover:shadow-sm'
              href={href}
              key={href}
            >
              <Icon aria-hidden='true' className='h-6 w-6 text-jpv-brand' />
              <span className='text-sm font-semibold text-jpv-ink'>{label}</span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
