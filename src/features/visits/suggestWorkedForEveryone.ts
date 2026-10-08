import type { WorkedForEveryone } from '@/types'

/**
 * Suggests the "worked for everyone?" answer from the diet ratings, so most logs need no extra tap.
 * Anyone left disappointed (a 2 or below) means "no"; everyone happy (4 or above) means "yes";
 * anything in between is "maybe". Returns undefined until something is rated.
 */
export function suggestWorkedForEveryone(
  ratings: readonly number[],
): WorkedForEveryone | undefined {
  if (ratings.length === 0) return undefined
  if (ratings.some((rating) => rating <= 2)) return 'no'
  if (ratings.every((rating) => rating >= 4)) return 'yes'
  return 'maybe'
}
