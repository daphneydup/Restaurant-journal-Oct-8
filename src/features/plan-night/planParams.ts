import { PRICE_TIERS, type PriceTier } from '@/types'

export const DEFAULT_BUDGET: PriceTier = 4

export interface PlanParams {
  lensIds: string[]
  maxPriceTier: PriceTier
}

/**
 * The plan lives in the URL (`?diets=vegan,steak&budget=3`) so it survives refresh and can be
 * shared. With no `diets` param the user's profile defaults apply; `diets=` means "none chosen".
 */
export function parsePlanParams(
  params: URLSearchParams,
  defaultLensIds: readonly string[],
): PlanParams {
  const diets = params.get('diets')
  const budget = Number(params.get('budget'))
  return {
    lensIds: diets === null ? [...defaultLensIds] : diets.split(',').filter(Boolean),
    maxPriceTier: (PRICE_TIERS as readonly number[]).includes(budget)
      ? (budget as PriceTier)
      : DEFAULT_BUDGET,
  }
}

export function serializePlanParams({ lensIds, maxPriceTier }: PlanParams): URLSearchParams {
  const params = new URLSearchParams()
  params.set('diets', lensIds.join(','))
  if (maxPriceTier !== DEFAULT_BUDGET) params.set('budget', String(maxPriceTier))
  return params
}
