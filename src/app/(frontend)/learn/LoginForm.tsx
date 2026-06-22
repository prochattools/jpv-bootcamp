'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { loginMemberAction, type MemberLoginActionState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      className='w-full rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f3425] disabled:cursor-not-allowed disabled:opacity-60'
      disabled={pending}
      type='submit'
    >
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  )
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const initialState: MemberLoginActionState = {}
  const [state, formAction] = useActionState(loginMemberAction, initialState)

  return (
    <form action={formAction} className='space-y-5'>
      <input name='next' type='hidden' value={nextPath} />

      <div>
        <label className='text-sm font-semibold text-[#153f2e]' htmlFor='email'>
          Email address
        </label>
        <input
          autoComplete='email'
          className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
          defaultValue={state.email ?? ''}
          id='email'
          name='email'
          required
          type='email'
        />
      </div>

      <div>
        <label className='text-sm font-semibold text-[#153f2e]' htmlFor='password'>
          Password
        </label>
        <input
          autoComplete='current-password'
          className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
          id='password'
          name='password'
          required
          type='password'
        />
      </div>

      {state.error && (
        <p className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700'>
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
