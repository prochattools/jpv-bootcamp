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
      className='jpv-button-primary'
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
        <label className='text-sm font-semibold text-jpv-ink' htmlFor='currentPassword'>
          Current password
        </label>
        <input
          autoComplete='current-password'
          className='mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
          id='currentPassword'
          name='currentPassword'
          required
          type='password'
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <label className='text-sm font-semibold text-jpv-ink' htmlFor='newPassword'>
            New password
          </label>
          <input
            autoComplete='new-password'
            className='mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
            id='newPassword'
            minLength={12}
            name='newPassword'
            required
            type='password'
          />
        </div>

        <div>
          <label className='text-sm font-semibold text-jpv-ink' htmlFor='newPasswordConfirmation'>
            Confirm new password
          </label>
          <input
            autoComplete='new-password'
            className='mt-2 w-full rounded-lg border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25'
            id='newPasswordConfirmation'
            minLength={12}
            name='newPasswordConfirmation'
            required
            type='password'
          />
        </div>
      </div>

      <p className='text-xs leading-5 text-jpv-muted'>Use at least 12 characters.</p>

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
