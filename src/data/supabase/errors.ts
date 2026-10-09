import { RepositoryError } from '../errors'

/** The parts of a PostgREST / Auth error we look at. */
export interface ErrorLike {
  message: string
  code?: string | null | undefined
  details?: string | null | undefined
}

/**
 * Translates a Supabase error into the app's RepositoryError, so screens never learn about
 * Postgres. Anything unrecognised is treated as "the service is unavailable", which shows the
 * retryable error state rather than pretending the user did something wrong.
 */
export function mapError(error: ErrorLike): RepositoryError {
  const cause = { cause: error }
  switch (error.code) {
    case '23505': // unique_violation
      return new RepositoryError('conflict', 'That already exists.', cause)
    case '23503': // foreign_key_violation
      return new RepositoryError(
        'invalid_reference',
        'That refers to something that no longer exists.',
        cause,
      )
    case '23502': // not_null_violation
    case '23514': // check_violation
    case '22P02': // invalid_text_representation (e.g. a bad uuid)
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
    case '22023': // invalid_parameter_value
      return new RepositoryError('validation', error.message, cause)
    case 'PGRST116': // a single row was expected but none was found
      return new RepositoryError('not_found', 'That was not found.', cause)
    default:
      return new RepositoryError(
        'unavailable',
        'We couldn’t reach the server. Please try again.',
        cause,
      )
  }
}

/** The parts of a Supabase Auth error we look at (AuthError has `code`, `status` and `name`). */
export interface AuthErrorLike {
  message: string
  code?: string | undefined
  status?: number | undefined
  name?: string | undefined
}

/**
 * Translates a Supabase Auth error. Messages here are for people: they never reveal whether an
 * email has an account (except where the user is choosing an email and must be told it's taken).
 */
export function mapAuthError(error: AuthErrorLike): RepositoryError {
  const cause = { cause: error }
  const code = error.code ?? ''
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
    return new RepositoryError('invalid_credentials', 'That email and password don’t match.', cause)
  }
  switch (code) {
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return new RepositoryError('email_taken', 'That email already has an account.', cause)
    case 'weak_password':
      return new RepositoryError('weak_password', 'Choose a stronger password.', cause)
    case 'email_not_confirmed':
      return new RepositoryError(
        'email_not_confirmed',
        'Confirm your email first. We sent you a link.',
        cause,
      )
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new RepositoryError(
        'rate_limited',
        'Too many attempts. Please wait a minute and try again.',
        cause,
      )
    case 'same_password':
      return new RepositoryError('validation', 'Choose a password you haven’t used before.', cause)
    case 'email_address_invalid':
    case 'validation_failed':
      return new RepositoryError('validation', error.message, cause)
    case 'session_not_found':
    case 'user_not_found':
    case 'no_authorization':
    case 'bad_jwt':
    case 'reauthentication_needed':
      return new RepositoryError('not_authenticated', 'Please log in again.', cause)
  }
  if (error.status === 429) {
    return new RepositoryError(
      'rate_limited',
      'Too many attempts. Please wait a minute and try again.',
      cause,
    )
  }
  if (error.name === 'AuthSessionMissingError') {
    return new RepositoryError('not_authenticated', 'Please log in again.', cause)
  }
  return new RepositoryError(
    'unavailable',
    'We couldn’t reach the server. Please try again.',
    cause,
  )
}
