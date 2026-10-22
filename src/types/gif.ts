import { z } from 'zod'

/**
 * Where a stored GIF may point: GIPHY's own servers over https, or (demo mode only) a small
 * generated SVG picture. Anything else is refused, so a visit can't be made to load an
 * arbitrary address.
 */
export function isAllowedGifUrl(value: string): boolean {
  if (value.startsWith('data:image/svg+xml')) return value.length <= 20_000
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'giphy.com' || url.hostname.endsWith('.giphy.com'))
    )
  } catch {
    return false
  }
}

export const gifUrlSchema = z
  .string()
  .max(20_000)
  .refine(isAllowedGifUrl, 'That GIF address isn’t allowed')

/** One search result. */
export const gifSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** The GIPHY page, used when sharing a link. */
  pageUrl: z.string().min(1),
  /** Small version for the picker grid. */
  previewUrl: gifUrlSchema,
  /** The version shown once chosen. */
  url: gifUrlSchema,
  width: z.number().positive(),
  height: z.number().positive(),
})
export type Gif = z.infer<typeof gifSchema>

export const gifPageSchema = z.object({
  gifs: z.array(gifSchema),
  /** Where the next page starts, or null when there is no more. */
  nextOffset: z.number().int().nonnegative().nullable(),
})
export type GifPage = z.infer<typeof gifPageSchema>

export interface GifSearchParams {
  /** Empty or missing shows what is trending. */
  query?: string
  limit?: number
  offset?: number
}
