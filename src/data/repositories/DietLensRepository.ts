import type { DietLens } from '@/types'

/**
 * Lenses are reference data, so this repository is read-only for now.
 * `list()` returns lenses ordered by `sortOrder`.
 */
export interface DietLensRepository {
  list(): Promise<DietLens[]>
  getById(id: string): Promise<DietLens | null>
}
