import type { ToastState } from '../hooks/useToast'

interface ToastProps {
  toast: ToastState | null
}

/** Fixed-position toast notification. Renders at bottom-right to avoid layout shift. */
export default function ToastNotification({ toast }: ToastProps) {
  if (!toast) return null

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`fixed right-6 bottom-6 z-50 rounded-md border px-4 py-2 text-sm shadow-lg ${
        toast.type === 'success'
          ? 'border-green-700 bg-green-900/90 text-green-200'
          : 'border-red-700 bg-red-900/90 text-red-200'
      }`}
    >
      {toast.message}
    </div>
  )
}
