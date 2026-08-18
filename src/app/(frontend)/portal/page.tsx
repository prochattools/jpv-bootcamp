import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AuthShell } from '@/components/auth/AuthShell'
import { MemberLoginForm } from '@/components/auth/MemberLoginForm'
import { MemberVerificationResendForm } from '@/components/auth/MemberVerificationResendForm'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
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
          Administrator account? Use{' '}
          <Link className='font-semibold text-jpv-ink underline decoration-jpv-green underline-offset-4' href='/admin/login'>
            the administrator sign-in
          </Link>
          .
        </p>
      )}
      introActions={(
        <div className='flex flex-col gap-3 sm:flex-row'>
          <Link className='jpv-button-primary' href='/upgrade'>Choose membership</Link>
          <Link className='jpv-button-secondary' href='/forgot-password'>Forgot password</Link>
        </div>
      )}
      title={branding.formTitle}
    >
      <h2 className='text-xl font-bold'>Member sign in</h2>
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

  const { memberId, payload } = await requirePortalMember('/portal')
  const dashboard = await getMemberCourseDashboard(payload, memberId)
  const availableCourses = dashboard.courses.filter((course) => course.allowed)

  return (
    <div className='space-y-10'>
      <section>
        <p className='jpv-eyebrow'>JPV Bootcamp</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Welcome back</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-neutral-600'>
          Continue your learning, review your available courses, and manage your member account.
        </p>
      </section>

      {dashboard.continueLesson ? (
        <section className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm'>
          <p className='jpv-eyebrow'>Continue learning</p>
          <h2 className='mt-3 text-xl font-semibold'>{dashboard.continueLesson.lessonTitle}</h2>
          <p className='mt-2 text-sm text-neutral-600'>{dashboard.continueLesson.courseTitle}</p>
          {dashboard.continueLesson.courseSlug && dashboard.continueLesson.lessonSlug ? (
            <Link
              className='jpv-button-primary mt-5 inline-flex'
              href={`/portal/courses/${dashboard.continueLesson.courseSlug}/lessons/${dashboard.continueLesson.lessonSlug}`}
            >
              Continue lesson
            </Link>
          ) : null}
        </section>
      ) : null}

      <section>
        <div className='flex items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-semibold'>Your courses</h2>
            <p className='mt-2 text-sm text-neutral-600'>Courses currently available to this member account.</p>
          </div>
          <Link className='text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline' href='/portal/courses'>
            View all
          </Link>
        </div>

        {availableCourses.length > 0 ? (
          <div className='mt-6 grid gap-5 md:grid-cols-2'>
            {availableCourses.slice(0, 4).map((course) => (
              <article className='rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm' key={course.id}>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <h3 className='text-lg font-semibold'>{course.title}</h3>
                    {course.shortDescription ? (
                      <p className='mt-2 text-sm leading-6 text-neutral-600'>{course.shortDescription}</p>
                    ) : null}
                  </div>
                  {course.progressPercent !== null ? (
                    <span className='rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700'>
                      {course.progressPercent}%
                    </span>
                  ) : null}
                </div>

                {course.slug ? (
                  <Link
                    className='mt-5 inline-flex text-sm font-semibold text-neutral-950 underline-offset-4 hover:underline'
                    href={`/portal/courses/${course.slug}`}
                  >
                    Open course
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className='mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600'>
            No courses are currently available for this account.
          </div>
        )}
      </section>
    </div>
  )
}
