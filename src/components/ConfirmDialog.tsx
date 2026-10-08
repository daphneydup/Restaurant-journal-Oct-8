import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** "Are you sure?" for anything destructive. The safe choice is listed first. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-5">
        <div className="text-ink-muted">{children}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
