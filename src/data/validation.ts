import type { z } from 'zod'
import { RepositoryError } from './errors'

/** Validates with a Zod schema and throws a RepositoryError('validation') on failure. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) =>
        issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      )
      .join('; ')
    throw new RepositoryError('validation', message, { cause: result.error })
  }
  return result.data
}
