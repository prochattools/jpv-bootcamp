'use client'

import { FormEvent, startTransition, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ComposerToolbar } from '@/components/community/ComposerToolbar'
import { MentionTextarea } from '@/components/community/MentionTextarea'
import { readResponseJson } from '@/components/community/readResponseJson'

type ImageAttachment = { id: string; filename: string }

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function CommunityCommentComposer({ spaceSlug, postId }: { spaceSlug: string; postId: string }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, setPending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [links, setLinks] = useState<string[]>([])
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [body, setBody] = useState('')

  function insertVideo(url: string) {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl) {
      setMessage('Use a valid http or https video URL.')
      return
    }
    setVideoUrl(safeUrl)
    setMessage(null)
  }

  function insertLink(url: string) {
    const safeUrl = safeExternalUrl(url)
    if (!safeUrl) {
      setMessage('Use a valid http or https link.')
      return
    }
    setLinks((current) => current.includes(safeUrl) ? current : [...current, safeUrl])
    setMessage(null)
  }

  async function uploadImage(file: File) {
    if (images.length >= 10) {
      setMessage('You can add up to 10 images to a reply.')
      return
    }

    setUploadingImage(true)
    setMessage(null)
    const data = new FormData()
    data.append('spaceSlug', spaceSlug)
    data.append('postId', postId)
    data.append('file', file)
    data.append('title', file.name)

    try {
      const response = await fetch('/api/community/files', { method: 'POST', body: data })
      const result = await readResponseJson<{ id?: string | number; filename?: string; error?: string }>(response)
      if (!response.ok || result?.id === undefined) throw new Error(result?.error || 'Unable to upload this image.')
      setImages((current) => [...current, { id: String(result.id), filename: result.filename || file.name }])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload this image.')
    } finally {
      setUploadingImage(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || uploadingImage) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/portal/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceSlug,
          postId,
          body,
          videoUrl,
          links,
          attachmentIds: images.map((image) => image.id),
        }),
      })
      const result = await readResponseJson<{ ok?: boolean; message?: string; attachmentWarning?: string | null }>(response)
      if (!response.ok || !result?.ok) throw new Error(result?.message || 'Unable to post your reply.')
      formRef.current?.reset()
      setBody('')
      setVideoUrl(null)
      setLinks([])
      setImages([])
      setMessage(result.attachmentWarning || 'Reply posted and is visible in the discussion.')
      const main = document.querySelector('main')
      const mainScrollTop = main?.scrollTop ?? 0
      const windowScrollY = window.scrollY
      startTransition(() => router.refresh())
      requestAnimationFrame(() => {
        if (main) main.scrollTop = mainScrollTop
        window.scrollTo({ top: windowScrollY, behavior: 'auto' })
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to post your reply.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className='mt-5 space-y-4' onSubmit={submit} ref={formRef}>
      <div>
        <label className='block text-sm font-bold text-jpv-brand-deep' htmlFor='comment-body'>Your reply</label>
      <MentionTextarea className='mt-1.5 w-full rounded-jpv-control border border-jpv-border bg-jpv-canvas px-4 py-3 text-sm text-jpv-ink outline-none transition focus:border-jpv-green-deep focus:ring-2 focus:ring-jpv-green/25' id='comment-body' maxLength={10000} name='body' onValueChange={setBody} placeholder='Share your reply…' required rows={4} value={body} />
      </div>
      <ComposerToolbar
        onInsertImage={(file) => uploadImage(file)}
        onInsertLink={insertLink}
        onInsertVideo={insertVideo}
        textareaId='comment-body'
      />
      {videoUrl || links.length > 0 || images.length > 0 ? (
        <div className='flex flex-wrap gap-2 text-xs text-jpv-muted'>
          {videoUrl ? (
            <button className='rounded-full border border-jpv-border bg-jpv-surface px-3 py-1.5 hover:text-jpv-ink' onClick={() => setVideoUrl(null)} type='button'>Video added · remove</button>
          ) : null}
          {links.map((link) => (
            <button className='max-w-full truncate rounded-full border border-jpv-border bg-jpv-surface px-3 py-1.5 hover:text-jpv-ink' key={link} onClick={() => setLinks((current) => current.filter((item) => item !== link))} title={link} type='button'>Link added · remove</button>
          ))}
          {images.map((image) => (
            <button className='max-w-full truncate rounded-full border border-jpv-border bg-jpv-surface px-3 py-1.5 hover:text-jpv-ink' key={image.id} onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))} title={image.filename} type='button'>Image: {image.filename} · remove</button>
          ))}
        </div>
      ) : null}
      <button className='jpv-button-primary min-h-11 disabled:cursor-wait disabled:opacity-70' disabled={pending || uploadingImage} type='submit'>
        {uploadingImage ? 'Uploading image…' : pending ? 'Posting…' : 'Submit reply'}
      </button>
      {message ? <p aria-live='polite' className='text-sm text-jpv-muted'>{message}</p> : null}
    </form>
  )
}
