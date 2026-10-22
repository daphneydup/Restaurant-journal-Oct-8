import { z } from 'zod'
import { parseOrThrow } from '../validation'
import {
  dietLensSchema,
  dishSchema,
  goBackEntrySchema,
  restaurantSchema,
  userSchema,
  visitSchema,
  type DietLens,
  type Dish,
  type GoBackEntry,
  type Restaurant,
  type User,
  type Visit,
} from '@/types'

/**
 * Database rows use snake_case and null; the app uses camelCase and omits missing fields. This
 * file is the ONLY place that knows both shapes. Rows coming back are checked against the same
 * Zod schemas the rest of the app trusts, so a bad row fails loudly here, not in a component.
 */

const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional()

const restaurantRow = z.object({
  id: z.string(),
  name: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  price_tier: z.number(),
  cuisine: nullable(z.string()),
  created_at: z.string(),
})

const visitRow = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  date: z.string(),
  worked_for_everyone: z.string(),
  price_tier: z.number(),
  worth_it: nullable(z.boolean()),
  note: nullable(z.string()),
  companions: z.array(z.string()),
  photo_urls: z.array(z.string()),
  gif_url: nullable(z.string()),
  gif_title: nullable(z.string()),
  created_at: z.string(),
  visit_ratings: z.array(z.object({ lens_id: z.string(), rating: z.number() })),
})

const dishRow = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  visit_id: nullable(z.string()),
  name: z.string(),
  verdict: z.string(),
  lens_ids: z.array(z.string()),
  photo_url: nullable(z.string()),
  created_at: z.string(),
})

const goBackRow = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  note: nullable(z.string()),
  added_at: z.string(),
})

const lensRow = z.object({
  id: z.string(),
  label: z.string(),
  short_label: z.string(),
  icon: z.string(),
  kind: z.string(),
  sort_order: z.number(),
})

const profileRow = z.object({
  id: z.string(),
  display_name: z.string(),
  home_city: z.string(),
  default_lens_ids: z.array(z.string()),
})

/** Columns to select, so ratings come back embedded in each visit. */
export const VISIT_SELECT = '*, visit_ratings(lens_id, rating)'

const present = <K extends string, V>(key: K, value: V | null | undefined) =>
  value === null || value === undefined ? {} : ({ [key]: value } as Record<K, V>)

export function toRestaurant(raw: unknown): Restaurant {
  const row = parseOrThrow(restaurantRow, raw)
  return parseOrThrow(restaurantSchema, {
    id: row.id,
    name: row.name,
    neighborhood: row.neighborhood,
    city: row.city,
    priceTier: row.price_tier,
    createdAt: row.created_at,
    ...present('cuisine', row.cuisine),
  })
}

export function toVisit(raw: unknown): Visit {
  const row = parseOrThrow(visitRow, raw)
  return parseOrThrow(visitSchema, {
    id: row.id,
    restaurantId: row.restaurant_id,
    date: row.date,
    ratings: row.visit_ratings.map((r) => ({ lensId: r.lens_id, rating: r.rating })),
    workedForEveryone: row.worked_for_everyone,
    priceTier: row.price_tier,
    companions: row.companions,
    photoUrls: row.photo_urls,
    createdAt: row.created_at,
    ...present('worthIt', row.worth_it),
    ...present('note', row.note),
    ...present('gifUrl', row.gif_url),
    ...present('gifTitle', row.gif_title),
  })
}

export function toDish(raw: unknown): Dish {
  const row = parseOrThrow(dishRow, raw)
  return parseOrThrow(dishSchema, {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    verdict: row.verdict,
    lensIds: row.lens_ids,
    createdAt: row.created_at,
    ...present('visitId', row.visit_id),
    ...present('photoUrl', row.photo_url),
  })
}

export function toGoBackEntry(raw: unknown): GoBackEntry {
  const row = parseOrThrow(goBackRow, raw)
  return parseOrThrow(goBackEntrySchema, {
    id: row.id,
    restaurantId: row.restaurant_id,
    addedAt: row.added_at,
    ...present('note', row.note),
  })
}

export function toLens(raw: unknown): DietLens {
  const row = parseOrThrow(lensRow, raw)
  return parseOrThrow(dietLensSchema, {
    id: row.id,
    label: row.label,
    shortLabel: row.short_label,
    icon: row.icon,
    kind: row.kind,
    sortOrder: row.sort_order,
  })
}

export function toUser(raw: unknown): User {
  const row = parseOrThrow(profileRow, raw)
  return parseOrThrow(userSchema, {
    id: row.id,
    displayName: row.display_name,
    homeCity: row.home_city,
    defaultLensIds: row.default_lens_ids,
  })
}

export const toList = <T>(raw: unknown, map: (row: unknown) => T): T[] =>
  parseOrThrow(z.array(z.unknown()), raw).map(map)

// ---- App -> database ------------------------------------------------------------------------

export const restaurantColumns = (r: Omit<Restaurant, 'id' | 'createdAt'>) => ({
  name: r.name,
  neighborhood: r.neighborhood,
  city: r.city,
  price_tier: r.priceTier,
  cuisine: r.cuisine ?? null,
})

export const visitColumns = (v: Omit<Visit, 'id' | 'createdAt' | 'ratings'>) => ({
  restaurant_id: v.restaurantId,
  date: v.date,
  worked_for_everyone: v.workedForEveryone,
  price_tier: v.priceTier,
  worth_it: v.worthIt ?? null,
  note: v.note ?? null,
  companions: v.companions,
  photo_urls: v.photoUrls,
  gif_url: v.gifUrl ?? null,
  gif_title: v.gifTitle ?? null,
})

export const ratingRows = (visitId: string, ratings: Visit['ratings']) =>
  ratings.map((r) => ({ visit_id: visitId, lens_id: r.lensId, rating: r.rating }))

export const dishColumns = (d: Omit<Dish, 'id' | 'createdAt'>) => ({
  restaurant_id: d.restaurantId,
  visit_id: d.visitId ?? null,
  name: d.name,
  verdict: d.verdict,
  lens_ids: d.lensIds,
  photo_url: d.photoUrl ?? null,
})

export const goBackColumns = (g: Omit<GoBackEntry, 'id' | 'addedAt'>) => ({
  restaurant_id: g.restaurantId,
  note: g.note ?? null,
})

export const profileColumns = (u: Omit<User, 'id'>) => ({
  display_name: u.displayName,
  home_city: u.homeCity,
  default_lens_ids: u.defaultLensIds,
})
