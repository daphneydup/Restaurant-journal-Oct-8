import type { ReactNode } from 'react'
import { RepositoryContext } from './repositoryContext'
import type { Repositories } from './repositories'

export function RepositoryProvider({
  repositories,
  children,
}: {
  repositories: Repositories
  children: ReactNode
}) {
  return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>
}
