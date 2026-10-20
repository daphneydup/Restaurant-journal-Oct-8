import { describe, expect, it } from 'vitest'
import { buildDemoSeed } from '@/data/mock/seed/demo'
import { TEST_NOW } from '@/test/testRepositories'
import { dishShareContent, inviteShareContent, restaurantShareContent } from './shareContent'

const seed = buildDemoSeed(TEST_NOW)
const restaurant = (id: string) => seed.restaurants.find((r) => r.id === id)!
const forRestaurant = (id: string) => ({
  restaurant: restaurant(id),
  visits: seed.visits.filter((v) => v.restaurantId === id),
  dishes: seed.dishes.filter((d) => d.restaurantId === id),
  lenses: seed.lenses,
  sharedBy: 'Summer',
})

describe('restaurantShareContent', () => {
  const content = restaurantShareContent(forRestaurant('r-ember'))

  it('writes a short caption with the spot, how it worked and what to order', () => {
    expect(content.text).toBe(
      'Ember & Orchard in Uptown. Worked for everyone in 3 of 3 visits. Order the Charred cauliflower steak. Found with Table for Everyone.',
    )
    expect(content.title).toBe('Ember & Orchard on Table for Everyone')
  })

  it('keeps the caption under the length that leaves room for a link on X', () => {
    const long = restaurantShareContent({
      ...forRestaurant('r-ember'),
      restaurant: { ...restaurant('r-ember'), name: 'N'.repeat(70), neighborhood: 'H'.repeat(60) },
    })
    expect(long.text.length).toBeLessThanOrEqual(200)
    expect(long.text.endsWith('…')).toBe(true)
  })

  it('describes the picture: title, subtitle, diet rows in lens order, and dishes to order', () => {
    const image = content.image!
    expect(image.title).toBe('Ember & Orchard')
    expect(image.subtitle).toBe('Uptown · $$$ · Wood-fired American')
    expect(image.highlight).toBe('Worked for everyone in 3 of 3 visits.')
    expect(image.rows.map((r) => r.label)).toEqual(['Vegan options', 'Steak / meat', 'Gluten-free'])
    expect(image.rows[0]!.value).toBe('4.3 / 5')
    expect(image.list).toEqual(['Charred cauliflower steak', '12oz dry-aged ribeye'])
    expect(image.footerRight).toBe('Recommended by Summer')
  })

  it('leaves out skipped dishes', () => {
    expect(content.image!.list).not.toContain('Burnt-honey flatbread')
  })

  it('names the file after the restaurant', () => {
    expect(content.fileName).toBe('ember-orchard.png')
  })

  it('copes with a spot nobody has visited yet', () => {
    const empty = restaurantShareContent(forRestaurant('r-lantern'))
    expect(empty.text).toBe('Lantern Alley in Knox-Henderson. Found with Table for Everyone.')
    expect(empty.image!.highlight).toBeUndefined()
    expect(empty.image!.rows).toEqual([])
    expect(empty.image!.list).toEqual([])
  })

  it('does not highlight "worked for everyone" when it never did', () => {
    const never = restaurantShareContent(forRestaurant('r-noodle')) // one visit, "maybe"
    expect(never.text).toBe(
      'Noodle & Nori in Deep Ellum. Order the Miso mushroom ramen. Found with Table for Everyone.',
    )
    expect(never.image!.highlight).toBeUndefined()
  })

  it('says "visit" for a single visit', () => {
    const single = restaurantShareContent(forRestaurant('r-copper'))
    expect(single.text).toContain('1 of 1 visit.')
    expect(single.text).not.toContain('visits')
  })
})

describe('dishShareContent', () => {
  const again = seed.dishes.find((d) => d.id === 'd-1')!
  const skip = seed.dishes.find((d) => d.id === 'd-3')!
  const args = (dish: typeof again) => ({
    dish,
    restaurant: restaurant(dish.restaurantId),
    lenses: seed.lenses,
    sharedBy: 'Summer',
  })

  it('recommends a dish worth ordering, with the diets it suits', () => {
    const content = dishShareContent(args(again))
    expect(content.text).toBe(
      'Order the Charred cauliflower steak at Ember & Orchard. Works for Vegan, Vegetarian, Gluten-free. Found with Table for Everyone.',
    )
    expect(content.image).toMatchObject({
      eyebrow: 'Order again',
      title: 'Charred cauliflower steak',
      subtitle: 'at Ember & Orchard · Uptown',
      listHeading: 'Works for',
      list: ['Vegan options', 'Vegetarian options', 'Gluten-free'],
      footerRight: 'Recommended by Summer',
    })
  })

  it('words a skipped dish as a warning', () => {
    const content = dishShareContent(args(skip))
    expect(content.text.startsWith('Skip the Burnt-honey flatbread at Ember & Orchard.')).toBe(true)
    expect(content.image!.eyebrow).toBe('Skip this one')
    expect(content.image!.footerRight).toBe('Skipped by Summer')
  })

  it('omits the "works for" part when the dish is not tagged', () => {
    const content = dishShareContent(args({ ...again, lensIds: [] }))
    expect(content.text).not.toContain('Works for')
    expect(content.image!.listHeading).toBeUndefined()
  })
})

describe('inviteShareContent', () => {
  it('is words only, from the person, short enough for X', () => {
    const content = inviteShareContent('Summer')
    expect(content.image).toBeUndefined()
    expect(content.text).toMatch(/^Summer here\./)
    expect(content.text).toContain('we both earn points')
    expect(content.text.length).toBeLessThanOrEqual(200)
  })
})
