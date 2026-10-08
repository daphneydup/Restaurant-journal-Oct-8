import { useState } from 'react'

/** "Now", captured once when the screen mounts, so relative times don't flicker during renders. */
export function useNow(): Date {
  const [now] = useState(() => new Date())
  return now
}
