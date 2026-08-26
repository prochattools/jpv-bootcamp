import Link from 'next/link'

type AuthFlowNoticeProps = {
  title: string
  message: string
  tone?: 'success' | 'error'
  action?: {
    href: string
    label: string
  }
}

export function AuthFlowNotice({
  title,
  message,
  tone = 'success',
  action,
}: AuthFlowNoticeProps) {
  const isError = tone === 'error'

  return (
    <div
      aria-atomic='true'
      aria-live={isError ? 'assertive' : 'polite'}
      className={`jpv-notice text-sm leading-6 ${isError ? 'jpv-notice-danger' : ''}`}
      role={isError ? 'alert' : 'status'}
    >
      <p className='font-semibold text-jpv-ink'>{title}</p>
      <p className='mt-1 text-jpv-muted'>{message}</p>
      {action ? (
        <Link
          className='mt-3 inline-flex min-h-11 items-center font-semibold text-jpv-brand underline-offset-4 hover:underline'
          href={action.href}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
