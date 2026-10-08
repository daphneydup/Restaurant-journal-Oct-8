/**
 * The CRUD contract every domain repository shares.
 *
 * - `getById` resolves `null` when nothing matches.
 * - `update` and `remove` reject with a `not_found` RepositoryError for unknown ids.
 * - Every method may reject with a RepositoryError (see ../errors).
 * - Field names are camelCase here; a Supabase implementation maps snake_case internally.
 */
export interface Repository<T extends { id: string }, TInput, TPatch = Partial<TInput>> {
  list(): Promise<T[]>
  getById(id: string): Promise<T | null>
  create(input: TInput): Promise<T>
  update(id: string, patch: TPatch): Promise<T>
  remove(id: string): Promise<void>
}
