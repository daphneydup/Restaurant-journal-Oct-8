import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ToastContext, type ToastApi, type ToastTone } from './toastContext'

type Toast = { id: number; message: string; tone: ToastTone }

const DISMISS_AFTER_MS = 6000
const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }
const TONES: Record<ToastTone, string> = {
  success: 'bg-basil-strong text-white',
  error: 'bg-danger text-white',
  info: 'bg-ink text-white',
}

/** Polite, non-blocking messages. Sits above the mobile tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback<ToastApi['showToast']>(
    (message, options) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, tone: options?.tone ?? 'success' }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const api = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map(({ id, message, tone }) => {
          const Icon = ICONS[tone]
          return (
            <div
              key={id}
              className={cn(
                'pointer-events-auto flex max-w-md items-center gap-3 rounded-pill py-2 pr-2 pl-4 shadow-raised',
                TONES[tone],
              )}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <p className="text-sm font-medium">{message}</p>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => dismiss(id)}
                className="flex size-touch shrink-0 items-center justify-center rounded-pill hover:bg-white/15"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
