'use client'

import { useEffect, useRef, type ReactNode } from 'react'

type AccessibleDialogProps = {
  open: boolean
  onClose: () => void
  labelledBy: string
  describedBy?: string
  children: ReactNode
  className?: string
}

export function AccessibleDialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
  className = '',
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      firstFocusable?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function restoreFocus() {
    returnFocusRef.current?.focus()
    returnFocusRef.current = null
  }

  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={`jpv-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={restoreFocus}
      ref={dialogRef}
    >
      {children}
    </dialog>
  )
}
