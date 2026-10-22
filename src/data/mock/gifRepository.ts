import type { GifRepository } from '../repositories'
import type { Gif } from '@/types'
import { clone } from './helpers'
import type { MockStore } from './store'

/**
 * DEMO ONLY. With no server there is no GIPHY, so the demo offers a few drawn stand-ins (small
 * SVG pictures with an emoji) that behave the same way: search by words, trending when empty,
 * paged. They are not animated.
 */
const ENTRIES: { id: string; title: string; emoji: string; words: string }[] = [
  { id: 'chefs-kiss', title: 'Chef’s kiss', emoji: '🤌', words: 'chef kiss perfect delicious' },
  { id: 'yum', title: 'Yum', emoji: '😋', words: 'yum tasty delicious food' },
  { id: 'cheers', title: 'Cheers', emoji: '🥂', words: 'cheers toast drinks celebrate wine' },
  {
    id: 'date-night',
    title: 'Date night',
    emoji: '🕯️',
    words: 'date night romantic dinner candle',
  },
  { id: 'worth-it', title: 'Worth it', emoji: '💸', words: 'worth it money value splurge' },
  { id: 'mind-blown', title: 'Mind blown', emoji: '🤯', words: 'mind blown wow amazing' },
  { id: 'hungry', title: 'So hungry', emoji: '🍽️', words: 'hungry starving dinner table' },
  { id: 'spicy', title: 'Spicy', emoji: '🌶️', words: 'spicy hot chili heat' },
  { id: 'sweet-tooth', title: 'Sweet tooth', emoji: '🍰', words: 'sweet dessert cake tooth' },
  { id: 'bon-appetit', title: 'Bon appétit', emoji: '👨‍🍳', words: 'bon appetit chef cook french' },
  { id: 'vegan-win', title: 'Vegan win', emoji: '🥦', words: 'vegan plant vegetables green win' },
  { id: 'steak-night', title: 'Steak night', emoji: '🥩', words: 'steak meat beef night grill' },
]

function toGif(entry: (typeof ENTRIES)[number]): Gif {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">` +
    `<rect width="200" height="120" fill="#1a1714"/><rect x="3" y="3" width="194" height="114" fill="none" stroke="#c9a45c" stroke-opacity=".5"/>` +
    `<text x="100" y="62" font-size="44" text-anchor="middle">${entry.emoji}</text>` +
    `<text x="100" y="98" font-size="14" fill="#e6cc92" text-anchor="middle" font-family="Georgia,serif">${entry.title}</text></svg>`
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  return {
    id: entry.id,
    title: entry.title,
    pageUrl: 'https://giphy.com/',
    previewUrl: url,
    url,
    width: 200,
    height: 120,
  }
}

export function createMockGifRepository(store: MockStore): GifRepository {
  return {
    search: ({ query = '', limit = 12, offset = 0 } = {}) =>
      store.run(() => {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
        const matches = ENTRIES.filter((e) => {
          const haystack = `${e.title} ${e.words}`.toLowerCase()
          return terms.every((t) => haystack.includes(t))
        })
        const page = matches.slice(offset, offset + limit).map(toGif)
        const next = offset + limit
        return clone({ gifs: page, nextOffset: next < matches.length ? next : null })
      }),
  }
}
