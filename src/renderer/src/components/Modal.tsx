import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export default function Modal({
  open,
  onClose,
  children,
  className = '',
  style
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Focus the first focusable element only when the modal opens (not on every render)
  useEffect(() => {
    if (!open) return

    const overlay = overlayRef.current
    if (overlay) {
      const firstFocusable = overlay.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [open])

  // Keyboard handler: Escape to close, Tab to trap focus
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const overlay = overlayRef.current
        if (!overlay) return

        const focusable = overlay.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`rounded-xl bg-gray-900 shadow-xl ${className}`} style={style}>
        {children}
      </div>
    </div>
  )
}
