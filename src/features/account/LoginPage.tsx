import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import {
  Button,
  ButtonLink,
  PageHeader,
  PasswordField,
  Spinner,
  TextField,
  useToast,
} from '@/components'
import { useAccount, useSignIn } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthCard, FormError, Notice } from './AuthCard'
import { describeAuthError } from './authMessages'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  useDocumentTitle('Log in')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const account = useAccount()
  const signIn = useSignIn()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors } = form.formState

  if (account.data && !account.data.isGuest) {
    return (
      <>
        <PageHeader title="Log in" />
        <AuthCard>
          <p>
            You’re already logged in as <strong>{account.data.email}</strong>.
          </p>
          <ButtonLink to="/account">Go to your account</ButtonLink>
        </AuthCard>
      </>
    )
  }

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    try {
      await signIn.mutateAsync(values)
      showToast('Welcome back')
      void navigate('/')
    } catch (error) {
      setFormError(describeAuthError(error, 'login'))
    }
  }

  return (
    <>
      <PageHeader title="Log in" description="Pick up your journal on any device." />
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
            error={errors.email?.message}
            {...form.register('email')}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...form.register('password')}
          />
          <FormError message={formError} />
          <Button type="submit" size="lg" disabled={signIn.isPending}>
            {signIn.isPending ? (
              <>
                <Spinner label="Logging in" className="text-white" /> Logging in…
              </>
            ) : (
              'Log in'
            )}
          </Button>
        </form>

        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-primary-strong underline">
            Forgot your password?
          </Link>
        </p>

        <hr className="border-line" />

        <div className="flex flex-col gap-3 text-sm">
          <p>
            New here?{' '}
            <Link to="/signup" className="font-medium text-primary-strong underline">
              Create an account
            </Link>
          </p>
          {account.data?.isGuest && (
            <Notice>
              You’re using a guest journal. Logging in switches to your saved journal, and this
              guest one stays on this device only. To keep it, create an account instead.
            </Notice>
          )}
        </div>
      </AuthCard>
    </>
  )
}
