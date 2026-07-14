'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import {
  changeMemberPasswordAction,
  type MemberPasswordChangeActionState,
} from '@/components/member/memberAccountActions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      className='rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f3425] disabled:cursor-not-allowed disabled:opacity-60'
      disabled={pending}
      type='submit'
    >
      {pending ? 'Changing password...' : 'Change password'}
    </button>
  )
}

export function PasswordChangeForm() {
  const initialState: MemberPasswordChangeActionState = {}
  const [state, formAction] = useActionState(changeMemberPasswordAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state.success])

  return (
    <form action={formAction} className='space-y-5' ref={formRef}>
      <div>
        <label className='text-sm font-semibold text-[#153f2e]' htmlFor='currentPassword'>
          Current password
        </label>
        <input
          autoComplete='current-password'
          className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
          id='currentPassword'
          name='currentPassword'
          required
          type='password'
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <label className='text-sm font-semibold text-[#153f2e]' htmlFor='newPassword'>
            New password
          </label>
          <input
            autoComplete='new-password'
            className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
            id='newPassword'
            minLength={12}
            name='newPassword'
            required
            type='password'
          />
        </div>

        <div>
          <label className='text-sm font-semibold text-[#153f2e]' htmlFor='newPasswordConfirmation'>
            Confirm new password
          </label>
          <input
            autoComplete='new-password'
            className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
            id='newPasswordConfirmation'
            minLength={12}
            name='newPasswordConfirmation'
            required
            type='password'
          />
        </div>
      </div>

      <p className='text-xs leading-5 text-[#68766f]'>Use at least 12 characters.</p>

      {state.error && (
        <p className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700'>
          {state.error}
        </p>
      )}
      {state.success && (
        <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'>
          Your password has been changed.
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
