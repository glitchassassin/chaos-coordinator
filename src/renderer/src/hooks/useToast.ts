import { useCallback, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error'

export interface ToastState {
  message: string
  type: ToastType
}

/** Hook that manages toast state with auto-dismiss. */
export function useToast(duration = 3000) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setToast({ message, type })
      timerRef.current = setTimeout(() => {
        setToast(null)
      }, duration)
    },
    [duration]
  )

  return { toast, showToast }
}
