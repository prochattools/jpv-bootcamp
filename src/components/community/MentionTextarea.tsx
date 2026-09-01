'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'

import { readResponseJson } from '@/components/community/readResponseJson'

type Suggestion = { memberId: string; displayName: string; email?: string | null }

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'defaultValue'> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export function MentionTextarea({ value, defaultValue = '', onValueChange, className, ...props }: Props) {
  const controlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const currentValue = controlled ? value : internalValue
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? currentValue.length
    const beforeCursor = currentValue.slice(0, cursor)
    const match = beforeCursor.match(/(?:^|\s)@([^\n@]{0,80})$/u)
    if (!match) {
      setSuggestions([])
      setMentionStart(null)
      return
    }
    const query = match[1]?.trim() ?? ''
    if (!query) {
      setSuggestions([])
      setMentionStart(null)
      return
    }
    const start = cursor - (match[1]?.length ?? 0) - 1
    setMentionStart(start)
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/portal/members/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const result = await readResponseJson<{ ok?: boolean; members?: Suggestion[] }>(response)
        setSuggestions(response.ok && result?.ok ? result.members ?? [] : [])
        setActiveIndex(0)
      } catch {
        if (!controller.signal.aborted) setSuggestions([])
      }
    }, 120)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [currentValue])

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (!controlled) setInternalValue(event.target.value)
    onValueChange?.(event.target.value)
  }

  function selectSuggestion(suggestion: Suggestion) {
    const textarea = textareaRef.current
    if (!textarea || mentionStart === null) return
    const cursor = textarea.selectionStart ?? currentValue.length
    const nextValue = `${currentValue.slice(0, mentionStart)}@${suggestion.displayName} ${currentValue.slice(cursor)}`
    if (!controlled) setInternalValue(nextValue)
    onValueChange?.(nextValue)
    setSuggestions([])
    setMentionStart(null)
    requestAnimationFrame(() => {
      textarea.focus()
      const nextCursor = mentionStart + suggestion.displayName.length + 2
      textarea.selectionStart = nextCursor
      textarea.selectionEnd = nextCursor
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) {
      props.onKeyDown?.(event)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
      return
    }
    if (event.key === 'Enter' && suggestions[activeIndex]) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
      return
    }
    props.onKeyDown?.(event)
  }

  return (
    <div className='relative'>
      <textarea {...props} className={className} onChange={onChange} onKeyDown={onKeyDown} ref={textareaRef} value={currentValue} />
      {suggestions.length ? (
        <div aria-label='Mention suggestions' className='absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-jpv-card border border-jpv-border bg-jpv-canvas p-1 shadow-jpv-floating' role='listbox'>
          {suggestions.map((suggestion, index) => (
            <button
              aria-selected={index === activeIndex}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-jpv-surface' : 'hover:bg-jpv-surface'}`}
              key={suggestion.memberId}
              onMouseDown={(event) => { event.preventDefault(); selectSuggestion(suggestion) }}
              role='option'
              type='button'
            >
              <span className='block font-semibold text-jpv-ink'>{suggestion.displayName}</span>
              {suggestion.email ? <span className='block text-xs text-jpv-muted'>{suggestion.email}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
