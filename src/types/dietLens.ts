import { z } from 'zod'
import { idSchema, text } from './common'

/**
 * A "dietary lens" is one axis a visit is rated on (Vegan options, Steak/meat, ...).
 * Lenses are DATA: the UI maps over whatever the repository returns, so adding a
 * lens never requires touching a component.
 */
export const dietLensSchema = z.object({
  id: idSchema,
  /** Full label, e.g. "Vegan options". */
  label: text(40),
  /** Compact label for chips and badges, e.g. "Vegan". */
  shortLabel: text(20),
  /** Key into the UI's icon map (not an icon itself, so the data stays portable). */
  icon: text(30),
  /** A way of eating ("preference") vs. a medical/ethical need ("restriction"). */
  kind: z.enum(['preference', 'restriction']),
  sortOrder: z.number().int().nonnegative(),
})
export type DietLens = z.infer<typeof dietLensSchema>
