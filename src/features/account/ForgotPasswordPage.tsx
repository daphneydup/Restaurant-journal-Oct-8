import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Button, PageHeader, Spinner, TextField } from '@/components'
import { useRepositories } from '@/data/repositoryContext'
import { useRequestPasswordReset } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthCard, FormError, Notice } from './AuthCard'
import { describeAuthError } from './authMessages'
import { emailOnlySchema, type EmailOnlyValues } from './schemas'

export function ForgotPasswordPage() {
  useDocumentTitle('Forgot password')
  const { kind } = useRepositories()
  const reset = useRequestPasswordReset()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }: EmailOnlyValues) {
    setFormError(null)
    try {
      await reset.mutateAsync(email)
      setSentTo(email.trim())
    } catch (error) {
      setFormError(describeAuthError(error, 'reset'))
    }
  }

  if (sentTo) {
    return (
      <>
        <PageHeader title="Check your email" />
        <AuthCard>
          <MailCheck aria-hidden className="size-10 text-basil-strong" />
          {/* The same words whether or not the address has an account, so this can't be used to find out. */}
          <p>
            If there’s an account for <strong>{sentTo}</strong>, a link to reset your password is on
            its way. It can take a minute. Check your spam folder too.
          </p>
          {kind === 'mock' && <Notice>Demo mode: no email is actually sent.</Notice>}
          <Link to="/login" className="font-medium text-primary-strong underline">
            Back to log in
          </Link>
        </AuthCard>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Forgot password"
        description="We’ll email you a link to choose a new one."
      />
      <AuthCard>
        <form
          noValidate
          onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          className="flex flex-col gap-4"
        >
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <FormError message={formError} />
          <Button type="submit" size="lg" disabled={reset.isPending}>
            {reset.isPending ? (
              <>
                <Spinner label="Sending" className="text-white" /> Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
        <Link to="/login" className="text-sm font-medium text-primary-strong underline">
          Back to log in
        </Link>
      </AuthCard>
    </>
  )
}
