import { isRepositoryError } from '@/data'

export type AuthAction = 'signup' | 'login' | 'reset' | 'email' | 'password' | 'delete'

/**
 * One place that turns a failure into a sentence a person can act on. The sign-in message is
 * deliberately the same for a wrong password and an unknown email, so it can't be used to find
 * out who has an account.
 */
export function describeAuthError(error: unknown, action: AuthAction): string {
  if (isRepositoryError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'That email and password don’t match. Check them and try again.'
      case 'email_taken':
        return action === 'signup'
          ? 'An account with that email already exists. Try logging in instead.'
          : 'Another account already uses that email.'
      case 'weak_password':
        return 'That password is too easy to guess. Try a longer one with a mix of words, numbers or symbols.'
      case 'email_not_confirmed':
        return 'Please confirm your email first. We sent you a link.'
      case 'rate_limited':
        return 'Too many attempts. Please wait a minute and try again.'
      case 'not_authenticated':
        return 'You need to be logged in to do that. Please log in again.'
      case 'validation':
        return error.message
    }
  }
  const failed: Record<AuthAction, string> = {
    signup: 'We couldn’t create your account',
    login: 'We couldn’t log you in',
    reset: 'We couldn’t send the reset link',
    email: 'We couldn’t change your email',
    password: 'We couldn’t change your password',
    delete: 'We couldn’t delete your account',
  }
  return `${failed[action]}. Check your connection and try again.`
}
