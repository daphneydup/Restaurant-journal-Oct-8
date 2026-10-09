import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button, PasswordField, Spinner, useToast } from '@/components'
import { useUpdatePassword } from '@/hooks/queries'
import { FormError } from './AuthCard'
import { describeAuthError } from './authMessages'
import { newPasswordSchema, type NewPasswordValues } from './schemas'

/** UPDATE: choose a new password. */
export function ChangePasswordForm() {
  const { showToast } = useToast()
  const update = useUpdatePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  async function onSubmit({ password }: NewPasswordValues) {
    setFormError(null)
    try {
      await update.mutateAsync(password)
      form.reset({ password: '', confirmPassword: '' })
      showToast('Password updated')
    } catch (error) {
      setFormError(describeAuthError(error, 'password'))
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-4"
    >
      <PasswordField
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...form.register('password')}
      />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register('confirmPassword')}
      />
      <FormError message={formError} />
      <div>
        <Button type="submit" variant="secondary" disabled={update.isPending}>
          {update.isPending ? (
            <>
              <Spinner label="Saving" /> Saving…
            </>
          ) : (
            'Change password'
          )}
        </Button>
      </div>
    </form>
  )
}
