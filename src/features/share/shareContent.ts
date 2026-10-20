import { formatAverage, lensStats, workedTally } from '@/lib/dietFit'
import { formatPriceTier } from '@/lib/format'
import { shareFileName } from '@/lib/share'
import type { ShareImageSpec } from '@/lib/shareImage'
import type { DietLens, Dish, Restaurant, Visit } from '@/types'

/** What gets posted: a caption, and (for spots and dishes) the picture. */
export interface ShareContent {
  /** The share sheet and email subject. */
  title: string
  /** The caption. Kept short enough for X once a link is added. */
  text: string
  image?: ShareImageSpec
  fileName?: string
}

/** The longest caption we write, leaving room for a link inside X's 280 characters. */
const MAX_TEXT = 200

function limit(text: string): string {
  return text.length <= MAX_TEXT ? text : `${text.slice(0, MAX_TEXT - 1).trimEnd()}…`
}

export function restaurantShareContent(args: {
  restaurant: Restaurant
  visits: readonly Visit[]
  dishes: readonly Dish[]
  lenses: readonly DietLens[]
  sharedBy: string
}): ShareContent {
  const { restaurant, visits, dishes, lenses, sharedBy } = args
  const stats = lensStats(visits)
  const worked = workedTally(visits)
  const favorites = dishes.filter((d) => d.verdict === 'order-again')

  // Only boast about it when it is true at least once: a post saying "worked for everyone in 0 of
  // 2 visits" would be an odd thing to recommend.
  const workedSentence =
    worked.yes > 0
      ? `Worked for everyone in ${worked.yes} of ${worked.total} ${worked.total === 1 ? 'visit' : 'visits'}.`
      : undefined

  const text = limit(
    [
      `${restaurant.name} in ${restaurant.neighborhood}.`,
      workedSentence,
      favorites[0] ? `Order the ${favorites[0].name}.` : undefined,
      'Found with Table for Everyone.',
    ]
      .filter(Boolean)
      .join(' '),
  )

  return {
    title: `${restaurant.name} on Table for Everyone`,
    text,
    fileName: shareFileName(restaurant.name),
    image: {
      eyebrow: 'Recommended',
      title: restaurant.name,
      subtitle: [restaurant.neighborhood, formatPriceTier(restaurant.priceTier), restaurant.cuisine]
        .filter(Boolean)
        .join(' · '),
      highlight: workedSentence,
      rowsHeading: 'How it works for each diet',
      rows: lenses.flatMap((lens) => {
        const stat = stats.find((s) => s.lensId === lens.id)
        return stat ? [{ label: lens.label, value: `${formatAverage(stat.average)} / 5` }] : []
      }),
      listHeading: 'Order these',
      list: favorites.map((d) => d.name),
      footerRight: `Recommended by ${sharedBy}`,
    },
  }
}

export function dishShareContent(args: {
  dish: Dish
  restaurant: Restaurant
  lenses: readonly DietLens[]
  sharedBy: string
}): ShareContent {
  const { dish, restaurant, lenses, sharedBy } = args
  const again = dish.verdict === 'order-again'
  const suits = lenses.filter((l) => dish.lensIds.includes(l.id))

  const text = limit(
    [
      again
        ? `Order the ${dish.name} at ${restaurant.name}.`
        : `Skip the ${dish.name} at ${restaurant.name}.`,
      suits.length > 0 ? `Works for ${suits.map((l) => l.shortLabel).join(', ')}.` : undefined,
      'Found with Table for Everyone.',
    ]
      .filter(Boolean)
      .join(' '),
  )

  return {
    title: `${dish.name} at ${restaurant.name}`,
    text,
    fileName: shareFileName(`${dish.name} ${restaurant.name}`),
    image: {
      eyebrow: again ? 'Order again' : 'Skip this one',
      title: dish.name,
      subtitle: `at ${restaurant.name} · ${restaurant.neighborhood}`,
      rows: [],
      listHeading: suits.length > 0 ? 'Works for' : undefined,
      list: suits.map((l) => l.label),
      footerRight: `${again ? 'Recommended' : 'Skipped'} by ${sharedBy}`,
    },
  }
}

/** The invite: no picture, just words and the person's link. */
export function inviteShareContent(sharedBy: string): ShareContent {
  return {
    title: 'Join me on Table for Everyone',
    text: limit(
      `${sharedBy} here. Table for Everyone helps groups with mixed diets find places that work for all of us. Join with my link and we both earn points.`,
    ),
  }
}
