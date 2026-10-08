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
