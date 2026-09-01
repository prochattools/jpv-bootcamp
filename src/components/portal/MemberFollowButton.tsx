'use client'

import { useState } from 'react'

import { readResponseJson } from '@/components/community/readResponseJson'

export function MemberFollowButton({ memberId, initialFollowing }: { memberId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/portal/members/${encodeURIComponent(memberId)}/follow`, { method: 'POST' })
      const result = await readResponseJson<{ ok?: boolean; follow?: { isFollowing?: boolean }; message?: string }>(response)
      if (!response.ok || !result?.ok) throw new Error(result?.message || 'Unable to update the follow status.')
      setFollowing(result.follow?.isFollowing === true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update the follow status.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className='mt-3'>
      <button aria-pressed={following} className='jpv-button-secondary min-h-10' disabled={pending} onClick={() => void toggle()} type='button'>
        {pending ? 'Saving…' : following ? 'Following' : 'Follow'}
      </button>
      {error ? <p aria-live='polite' className='mt-2 text-xs text-red-700'>{error}</p> : null}
    </div>
  )
}
