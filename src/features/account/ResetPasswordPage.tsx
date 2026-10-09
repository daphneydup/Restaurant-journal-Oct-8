import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { Button, ButtonLink, PageHeader, PasswordField, Spinner, useToast } from '@/components'
import { useIsRecovering, useUpdatePassword } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthCard, FormError } from './AuthCard'
import { describeAuthError } from './authMessages'
import { newPasswordSchema, type NewPasswordValues } from './schemas'

/** Where the link in the reset email lands. Only usable while the emailed link's session is live. */
export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const recovering = useIsRecovering()
  const updatePassword = useUpdatePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  if (!recovering) {
    return (
      <>
        <PageHeader title="Choose a new password" />
        <AuthCard>
          <p>This reset link has expired or was already used.</p>
          <ButtonLink to="/forgot-password">Send me a new link</ButtonLink>
        </AuthCard>
      </>
    )
  }

  async function onSubmit({ password }: NewPasswordValues) {
    setFormError(null)
    try {
      await updatePassword.mutateAsync(password)
      showToast('Password updated')
      void navigate('/account')
    } catch (error) {
      setFormError(describeAuthError(error, 'password'))
    }
  }

  return (
    <>
      <PageHeader title="Choose a new password" />
      <AuthCard>
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
          <Button type="submit" size="lg" disabled={updatePassword.isPending}>
            {updatePassword.isPending ? (
              <>
                <Spinner label="Saving" className="text-white" /> Saving…
              </>
            ) : (
              'Save new password'
            )}
          </Button>
        </form>
      </AuthCard>
    </>
  )
}
