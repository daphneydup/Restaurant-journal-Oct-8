import { z } from 'zod'

/** 1 = $, 2 = $$, 3 = $$$, 4 = $$$$. */
export const PRICE_TIERS = [1, 2, 3, 4] as const

export const priceTierSchema = z.literal(PRICE_TIERS)
export type PriceTier = z.infer<typeof priceTierSchema>
