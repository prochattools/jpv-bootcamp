'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import {
  archiveMemberGroupAction,
  createMemberGroupAction,
  deleteMemberGroupAction,
  updateMemberGroupAction,
} from '@/app/(frontend)/portal/members/actions'
import type { MemberGroupSummary } from '@/lib/portalAdmin/memberGroupCommands'

type MemberOption = { id: string; label: string; email?: string | null; isAdministrator?: boolean }

type Props = {
  members: MemberOption[]
  groups: MemberGroupSummary[]
}

const inputClass = 'w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2.5 text-sm text-jpv-ink'

export function MemberGroupsAdmin({ members, groups: initialGroups }: Props) {
  const [groups, setGroups] = useState(initialGroups)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null
  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return members
    return members.filter((member) => `${member.label} ${member.email ?? ''}`.toLowerCase().includes(query))
  }, [memberSearch, members])

  useEffect(() => {
    if (!selectedGroup) {
      setName('')
      setDescription('')
      setSelectedMemberIds([])
      return
    }
    setName(selectedGroup.name)
    setDescription(selectedGroup.description ?? '')
    setSelectedMemberIds(selectedGroup.memberIds)
    setMessage(null)
  }, [selectedGroup])

  function startNewGroup() {
    setSelectedGroupId(null)
    setName('')
    setDescription('')
    setSelectedMemberIds([])
    setMemberSearch('')
    setMessage(null)
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId])
  }

  function toggleVisibleMembers() {
    const visibleIds = visibleMembers.map((member) => member.id)
    const allSelected = visibleIds.every((id) => selectedMemberIds.includes(id))
    setSelectedMemberIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])))
  }

  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = selectedGroup
        ? await updateMemberGroupAction(selectedGroup.id, {
            name,
            description,
            memberIds: selectedMemberIds,
            expectedUpdatedAt: selectedGroup.updatedAt,
          })
        : await createMemberGroupAction({ name, description, memberIds: selectedMemberIds })
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      if (result.data) {
        setGroups((current) => selectedGroup
          ? current.map((group) => group.id === result.data!.id ? result.data! : group)
          : [...current, result.data!].sort((left, right) => left.name.localeCompare(right.name)))
        setSelectedGroupId(result.data.id)
      }
      setMessage('Group saved.')
    })
  }

  function archive() {
    if (!selectedGroup || !window.confirm(`Archive ${selectedGroup.name}? Existing Rooms and Updates will keep their history, but the group will no longer be selectable.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await archiveMemberGroupAction(selectedGroup.id, selectedGroup.updatedAt)
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      if (result.data) setGroups((current) => current.map((group) => group.id === result.data!.id ? result.data! : group))
      setMessage('Group archived.')
    })
  }

  function remove() {
    if (!selectedGroup || !window.confirm(`Permanently delete ${selectedGroup.name}? This cannot be undone.`)) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteMemberGroupAction(selectedGroup.id, true)
      if ('message' in result) {
        setMessage(result.message)
        return
      }
      setGroups((current) => current.filter((group) => group.id !== selectedGroup.id))
      startNewGroup()
      setMessage('Group deleted.')
    })
  }

  return (
    <section className='space-y-5 rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='jpv-eyebrow'>Administrator tools</p>
          <h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Shared member groups</h2>
          <p className='mt-2 max-w-2xl text-sm leading-6 text-jpv-muted'>Manage reusable audiences for Rooms and Updates. Groups organize communication; they do not grant course or community access.</p>
        </div>
        <button className='jpv-button-secondary min-h-10' onClick={startNewGroup} type='button'>New group</button>
      </div>

      <div className='grid gap-5 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.6fr)]'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-jpv-muted'>Groups</p>
          {groups.length === 0 ? <p className='text-sm text-jpv-muted'>No groups yet.</p> : null}
          {groups.map((group) => (
            <button
              className={`block w-full rounded-jpv-card border px-3 py-3 text-left ${selectedGroupId === group.id ? 'border-jpv-brand-deep bg-jpv-surface' : 'border-jpv-border bg-jpv-canvas'}`}
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              type='button'
            >
              <span className='block truncate text-sm font-semibold text-jpv-ink'>{group.name}</span>
              <span className='mt-1 block text-xs text-jpv-muted'>{group.memberCount} member{group.memberCount === 1 ? '' : 's'} · {group.status}</span>
            </button>
          ))}
        </div>

        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='text-sm font-semibold text-jpv-ink'>Group name<input className={`mt-1.5 ${inputClass}`} onChange={(event) => setName(event.target.value)} value={name} /></label>
            <label className='text-sm font-semibold text-jpv-ink'>Description <span className='font-normal text-jpv-muted'>(optional)</span><input className={`mt-1.5 ${inputClass}`} onChange={(event) => setDescription(event.target.value)} value={description} /></label>
          </div>

          <div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm font-semibold text-jpv-ink'>Members <span className='font-normal text-jpv-muted'>({selectedMemberIds.length} selected)</span></p>
              <button className='text-xs font-semibold text-jpv-brand-deep underline' onClick={toggleVisibleMembers} type='button'>Select / clear visible</button>
            </div>
            <input aria-label='Search members and administrators' className={`mt-2 ${inputClass}`} onChange={(event) => setMemberSearch(event.target.value)} placeholder='Search members and administrators…' value={memberSearch} />
            <div aria-label='Member and administrator choices' className='mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-jpv-card border border-jpv-border p-3 sm:grid-cols-2' role='group'>
              {visibleMembers.map((member) => (
                <label className='flex items-start gap-2 text-sm text-jpv-ink' key={member.id}>
                  <input checked={selectedMemberIds.includes(member.id)} className='mt-0.5' onChange={() => toggleMember(member.id)} type='checkbox' />
                  <span className='min-w-0'><span className='flex flex-wrap items-center gap-1.5'><span>{member.label}</span>{member.isAdministrator ? <span className='rounded-full bg-jpv-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-jpv-brand-deep'>Admin</span> : null}</span>{member.email ? <span className='block truncate text-xs text-jpv-muted'>{member.email}</span> : null}</span>
                </label>
              ))}
              {visibleMembers.length === 0 ? <p className='text-sm text-jpv-muted'>No members or administrators match this search.</p> : null}
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <button className='jpv-button-primary min-h-10' disabled={pending || !name.trim()} onClick={save} type='button'>{pending ? 'Saving…' : selectedGroup ? 'Save changes' : 'Create group'}</button>
            {selectedGroup?.status === 'active' ? <button className='jpv-button-secondary min-h-10' disabled={pending} onClick={archive} type='button'>Archive</button> : null}
            {selectedGroup ? <button className='min-h-10 rounded-jpv-control border border-red-300 px-3 text-sm font-semibold text-red-700' disabled={pending} onClick={remove} type='button'>Delete</button> : null}
            {message ? <span aria-live='polite' className='text-sm text-jpv-muted'>{message}</span> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
