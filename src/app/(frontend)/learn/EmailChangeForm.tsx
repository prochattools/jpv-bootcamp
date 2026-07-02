'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  requestMemberEmailChangeAction,
  type MemberEmailChangeActionState,
} from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      className='rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f3425] disabled:cursor-not-allowed disabled:opacity-60'
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
        <label className='text-sm font-semibold text-[#153f2e]' htmlFor='newEmail'>
          New email address
        </label>
        <input
          autoComplete='email'
          className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
          id='newEmail'
          maxLength={320}
          name='newEmail'
          required
          type='email'
        />
      </div>
      <p className='text-xs leading-5 text-[#68766f]'>
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
