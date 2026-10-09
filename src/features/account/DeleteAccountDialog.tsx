import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button, Dialog, Spinner, TextField } from '@/components'
import { FormError } from './AuthCard'
import { describeAuthError } from './authMessages'
import { DELETE_PHRASE, deleteConfirmSchema, type DeleteConfirmValues } from './schemas'

/** DELETE: permanent, so it needs the word typed out. */
export function DeleteAccountDialog({
  open,
  onClose,
  isGuest,
  onConfirm,
  busy,
}: {
  open: boolean
  onClose: () => void
  isGuest: boolean
  /** Rejects if the deletion fails; the dialog then shows why and stays open. */
  onConfirm: () => Promise<void>
  busy: boolean
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<DeleteConfirmValues>({
    resolver: zodResolver(deleteConfirmSchema),
    defaultValues: { phrase: '' },
  })

  async function onSubmit() {
    setFormError(null)
    try {
      await onConfirm()
    } catch (error) {
      setFormError(describeAuthError(error, 'delete'))
    }
  }

  function close() {
    form.reset({ phrase: '' })
    setFormError(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={isGuest ? 'Delete guest journal?' : 'Delete your account?'}
    >
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className="flex flex-col gap-4"
      >
        <p>
          {isGuest
            ? 'Every spot, visit and dish in this guest journal will be permanently deleted.'
            : 'Your account and every spot, visit, dish and Go-Back entry in it will be permanently deleted.'}{' '}
          <strong>This can’t be undone.</strong>
        </p>
        <TextField
          label={`Type ${DELETE_PHRASE} to confirm`}
          autoComplete="off"
          autoCapitalize="characters"
          error={form.formState.errors.phrase?.message}
          {...form.register('phrase')}
        />
        <FormError message={formError} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? (
              <>
                <Spinner label="Deleting" className="text-white" /> Deleting…
              </>
            ) : isGuest ? (
              'Delete my journal'
            ) : (
              'Delete my account'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
