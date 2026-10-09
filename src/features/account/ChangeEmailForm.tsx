import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button, Spinner, TextField, useToast } from '@/components'
import { useUpdateEmail } from '@/hooks/queries'
import { FormError, Notice } from './AuthCard'
import { describeAuthError } from './authMessages'
import { emailOnlySchema, type EmailOnlyValues } from './schemas'

/** UPDATE: change the email address. It may need confirming from the new inbox first. */
export function ChangeEmailForm() {
  const { showToast } = useToast()
  const update = useUpdateEmail()
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingFor, setPendingFor] = useState<string | null>(null)
  const form = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }: EmailOnlyValues) {
    setFormError(null)
    setPendingFor(null)
    try {
      const change = await update.mutateAsync(email)
      form.reset({ email: '' })
      if (change.needsEmailConfirmation) setPendingFor(email.trim().toLowerCase())
      else showToast('Email updated')
    } catch (error) {
      setFormError(describeAuthError(error, 'email'))
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-4"
    >
      <TextField
        label="New email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      {pendingFor && (
        <Notice>
          We sent a confirmation link to <strong>{pendingFor}</strong>. Your email changes once you
          click it.
        </Notice>
      )}
      <FormError message={formError} />
      <div>
        <Button type="submit" variant="secondary" disabled={update.isPending}>
          {update.isPending ? (
            <>
              <Spinner label="Saving" /> Saving…
            </>
          ) : (
            'Change email'
          )}
        </Button>
      </div>
    </form>
  )
}
