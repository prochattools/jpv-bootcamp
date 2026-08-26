'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  requestMemberEmailChangeAction,
  type MemberEmailChangeActionState,
} from '@/components/member/memberAccountActions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      className='jpv-button-primary'
      disabled={pending}
      type='submit'
    >
      {pending ? 'Sending confirmation…' : 'Request email change'}
    </button>
  )
}

export function EmailChangeForm() {
  const [state, formAction] = useActionState<MemberEmailChangeActionState, FormData>(
    requestMemberEmailChangeAction,
    {},
  )

  return (
    <form action={formAction} className='space-y-5'>
      <div>
        <label className='text-sm font-semibold text-jpv-ink' htmlFor='newEmail'>
          New email address
        </label>
        <input
          autoComplete='email'
          className='mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
          id='newEmail'
          maxLength={320}
          name='newEmail'
          required
          type='email'
        />
      </div>
      <p className='text-xs leading-5 text-jpv-muted'>
        Your current sign-in email remains active until the new address is confirmed through a secure, single-use link.
      </p>
      {state.error ? (
        <p className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700'>
          {state.error}
        </p>
      ) : null}
      {state.submitted && state.message ? (
        <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  )
}
