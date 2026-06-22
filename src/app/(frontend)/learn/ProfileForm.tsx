'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { updateMemberProfileAction, type MemberProfileActionState } from './actions'

type ProfileFormProps = {
  profile: {
    displayName: string | null
    timezone: string | null
    phone: string | null
    company: string | null
  } | null
  fallbackDisplayName: string
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      className='rounded-full bg-[#153f2e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f3425] disabled:cursor-not-allowed disabled:opacity-60'
      disabled={pending}
      type='submit'
    >
      {pending ? 'Saving...' : 'Save profile'}
    </button>
  )
}

export function ProfileForm({ fallbackDisplayName, profile }: ProfileFormProps) {
  const initialState: MemberProfileActionState = {}
  const [state, formAction] = useActionState(updateMemberProfileAction, initialState)

  return (
    <form action={formAction} className='space-y-5'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <label className='text-sm font-semibold text-[#153f2e]' htmlFor='displayName'>
            Display name
          </label>
          <input
            className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
            defaultValue={profile?.displayName ?? fallbackDisplayName}
            id='displayName'
            maxLength={80}
            name='displayName'
            required
            type='text'
          />
        </div>

        <div>
          <label className='text-sm font-semibold text-[#153f2e]' htmlFor='company'>
            Company
          </label>
          <input
            className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
            defaultValue={profile?.company ?? ''}
            id='company'
            maxLength={100}
            name='company'
            type='text'
          />
        </div>

        <div>
          <label className='text-sm font-semibold text-[#153f2e]' htmlFor='phone'>
            Phone
          </label>
          <input
            className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
            defaultValue={profile?.phone ?? ''}
            id='phone'
            maxLength={40}
            name='phone'
            type='tel'
          />
        </div>

        <div className='sm:col-span-2'>
          <label className='text-sm font-semibold text-[#153f2e]' htmlFor='timezone'>
            Timezone
          </label>
          <input
            className='mt-2 w-full rounded-xl border border-[#153f2e]/15 bg-white px-4 py-3 text-sm text-[#14261d] outline-none transition focus:border-[#9d864b] focus:ring-2 focus:ring-[#d9c897]/45'
            defaultValue={profile?.timezone ?? ''}
            id='timezone'
            maxLength={80}
            name='timezone'
            placeholder='Europe/Lisbon'
            type='text'
          />
        </div>
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
