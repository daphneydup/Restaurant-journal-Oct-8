import { createContext, useContext } from 'react'
import type { Repositories } from './repositories'

export const RepositoryContext = createContext<Repositories | null>(null)

/** Access the repositories provided by <RepositoryProvider>. Prefer the query hooks in most code. */
export function useRepositories(): Repositories {
  const repositories = useContext(RepositoryContext)
  if (!repositories) {
    throw new Error('useRepositories must be used inside <RepositoryProvider>')
  }
  return repositories
}
