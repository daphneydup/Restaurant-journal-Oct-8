import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import {
  Button,
  ButtonLink,
  PageHeader,
  Photo,
  PasswordField,
  Spinner,
  TextField,
  useToast,
} from '@/components'
import { useAccount, useSignUp } from '@/hooks/queries'
import { TestimonialCarousel } from '@/features/testimonials/TestimonialCarousel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { pendingReferral, subscribeToPendingReferral } from '@/lib/pendingReferral'
import { POINTS } from '@/lib/rewardRules'
import { AuthCard, FormError, Notice } from './AuthCard'
import { describeAuthError } from './authMessages'
import { signUpSchema, type SignUpValues } from './schemas'

export function SignUpPage() {
  useDocumentTitle('Create account')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const account = useAccount()
  const signUp = useSignUp()
  const invite = useSyncExternalStore(subscribeToPendingReferral, pendingReferral, () => null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  if (confirmEmail) {
    return (
      <>
        <PageHeader title="Check your email" />
        <AuthCard>
          <MailCheck aria-hidden className="size-10 text-basil-strong" />
          <p>
            We sent a link to <strong>{confirmEmail}</strong>. Click it to finish creating your
            account.
          </p>
          <Notice>
            Your journal is safe in the meantime. It will be yours as soon as you confirm.
          </Notice>
          <ButtonLink to="/" variant="secondary">
            Back to my spots
          </ButtonLink>
        </AuthCard>
      </>
    )
  }

  if (account.data && !account.data.isGuest) {
    return (
      <>
        <PageHeader title="Create account" />
        <AuthCard>
          <p>
            You already have an account (<strong>{account.data.email}</strong>).
          </p>
          <ButtonLink to="/account">Go to your account</ButtonLink>
        </AuthCard>
      </>
    )
  }

  async function onSubmit({ email, password }: SignUpValues) {
    setFormError(null)
    try {
      const result = await signUp.mutateAsync({ email, password })
      if (result.needsEmailConfirmation) {
        setConfirmEmail(email.trim().toLowerCase())
        return
      }
      showToast('Account created')
      void navigate('/account')
    } catch (error) {
      setFormError(describeAuthError(error, 'signup'))
    }
  }

  return (
    <>
      <PageHeader
        title="Create account"
        description="Keep your journal safe and use it on any device."
      />
      <Photo
        name="eveningTables"
        position="center 40%"
        className="mx-auto mb-4 h-32 max-w-md rounded-card"
      />
      <AuthCard>
        <Notice>Everything you’ve logged so far comes with you.</Notice>
        {invite && (
          <Notice>
            A friend’s invite is waiting: you’ll get {POINTS.referral} bonus points as soon as your
            account is ready.
          </Notice>
        )}
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
            autoComplete="new-password"
            hint="At least 8 characters."
            error={errors.password?.message}
            {...form.register('password')}
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />
          <FormError message={formError} />
          <Button type="submit" size="lg" disabled={signUp.isPending}>
            {signUp.isPending ? (
              <>
                <Spinner label="Creating account" className="text-on-primary" /> Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </form>
        <p className="text-sm">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-strong underline">
            Log in
          </Link>
        </p>
      </AuthCard>
      <div className="mx-auto mt-6 max-w-md">
        <TestimonialCarousel />
      </div>
    </>
  )
}
