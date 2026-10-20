export type RepositoryErrorCode =
  /** The requested row does not exist. */
  | 'not_found'
  /** A foreign key points at a row that does not exist (maps to Postgres 23503). */
  | 'invalid_reference'
  /** The data failed schema validation. */
  | 'validation'
  /** A uniqueness rule was violated (maps to Postgres 23505). */
  | 'conflict'
  /** The backing service could not be reached. */
  | 'unavailable'
  /** Local storage is full (mock layer; photos are the usual cause). */
  | 'storage_full'
  /** Wrong email or password. */
  | 'invalid_credentials'
  /** Sign-up with an email that already has an account. */
  | 'email_taken'
  /** The password was rejected as too weak. */
  | 'weak_password'
  /** The email address has not been confirmed yet. */
  | 'email_not_confirmed'
  /** Too many attempts; try again later. */
  | 'rate_limited'
  /** The action needs a signed-in account (a guest can't do it). */
  | 'not_authenticated'
  /** A reward costs more points than the person has. */
  | 'insufficient_points'

/**
 * The only error type repositories throw. UI code branches on `code`, so future
 * Supabase repositories just need to map their errors onto these codes.
 */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RepositoryError'
    this.code = code
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError
}
