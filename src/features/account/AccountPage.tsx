import { LogOut, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components'
import { useAccount, useDeleteAccount, useSignOut } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { AuthUser } from '@/types'
import { describeAuthError } from './authMessages'
import { ChangeEmailForm } from './ChangeEmailForm'
import { ChangePasswordForm } from './ChangePasswordForm'
import { DeleteAccountDialog } from './DeleteAccountDialog'

const joined = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  )

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl">{title}</h2>
      {children}
    </Card>
  )
}

/** READ the account, plus the Update and Delete sections. */
export function AccountPage() {
  useDocumentTitle('Account')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const account = useAccount()
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (account.isError) {
    return (
      <>
        <PageHeader title="Account" />
        <ErrorState title="We couldn’t load your account" onRetry={() => void account.refetch()} />
      </>
    )
  }
  if (account.isPending) {
    return (
      <>
        <PageHeader title="Account" />
        <LoadingRegion label="Loading your account" className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </LoadingRegion>
      </>
    )
  }

  // null means nobody has signed in yet: that is just a guest-to-be.
  const user: AuthUser | null = account.data
  const isGuest = user === null || user.isGuest

  function logOut() {
    signOut.mutate(undefined, {
      onSuccess: () => {
        setConfirmingSignOut(false)
        showToast('You’re logged out')
        void navigate('/')
      },
      onError: (error) => showToast(describeAuthError(error, 'login'), { tone: 'error' }),
    })
  }

  async function confirmDelete() {
    await deleteAccount.mutateAsync()
    setDeleting(false)
    showToast(isGuest ? 'Your journal was deleted' : 'Your account was deleted')
    void navigate('/')
  }

  return (
    <>
      <PageHeader
        title="Account"
        description={isGuest ? 'You’re using a guest journal.' : 'Your login and your data.'}
      />

      <div className="flex flex-col gap-5">
        <Section title="Your account">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-ink-muted">Status</dt>
            <dd className="flex items-center gap-2 font-medium">
              <UserRound aria-hidden className="size-4" />
              {isGuest ? 'Guest' : 'Member'}
            </dd>
            <dt className="text-ink-muted">Email</dt>
            <dd className="font-medium break-all">{user?.email ?? 'None yet'}</dd>
            {user?.pendingEmail && (
              <>
                <dt className="text-ink-muted">Waiting on</dt>
                <dd className="break-all">
                  <span className="font-medium">{user.pendingEmail}</span>, once you click the link
                  we emailed.
                </dd>
              </>
            )}
            {user && (
              <>
                <dt className="text-ink-muted">{isGuest ? 'Guest since' : 'Member since'}</dt>
                <dd>{joined(user.createdAt)}</dd>
              </>
            )}
          </dl>

          {isGuest && (
            <div className="flex flex-col gap-3">
              <p className="text-ink-muted">
                A guest journal is saved only in this browser. Create an account to keep it safe and
                use it on other devices. Everything you’ve logged comes with you.
              </p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink to="/signup">Create an account</ButtonLink>
                <ButtonLink to="/login" variant="secondary">
                  Log in
                </ButtonLink>
              </div>
            </div>
          )}
        </Section>

        {!isGuest && (
          <>
            <Section title="Change email">
              <ChangeEmailForm />
            </Section>
            <Section title="Change password">
              <ChangePasswordForm />
            </Section>
          </>
        )}

        <Section title={isGuest ? 'Leave this guest session' : 'Log out'}>
          <p className="text-ink-muted">
            {isGuest
              ? 'You can’t get back to a guest journal after leaving it. Create an account first to keep it.'
              : 'You can log back in any time with your email and password.'}
          </p>
          <div>
            <Button
              variant="secondary"
              disabled={signOut.isPending}
              onClick={() => (isGuest ? setConfirmingSignOut(true) : logOut())}
            >
              <LogOut aria-hidden className="size-4" />{' '}
              {isGuest ? 'Leave guest session' : 'Log out'}
            </Button>
          </div>
        </Section>

        <Section title="Delete">
          <p className="text-ink-muted">
            {isGuest
              ? 'Permanently delete this guest journal and everything in it.'
              : 'Permanently delete your account and everything in it. This can’t be undone.'}
          </p>
          <div>
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              onClick={() => setDeleting(true)}
            >
              <Trash2 aria-hidden className="size-4" />{' '}
              {isGuest ? 'Delete guest journal' : 'Delete account'}
            </Button>
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Leave this guest session?"
        confirmLabel="Leave and lose this journal"
        cancelLabel="Stay"
        busy={signOut.isPending}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={logOut}
      >
        <p>
          Nobody can get back to a guest journal once it’s left. If you want to keep it, cancel and
          create an account first.
        </p>
      </ConfirmDialog>

      <DeleteAccountDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        isGuest={isGuest}
        busy={deleteAccount.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
