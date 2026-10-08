import { useEffect } from 'react'

const APP_NAME = 'Table for Everyone'

/** Sets document.title so screen-reader users hear the new page on route changes. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
