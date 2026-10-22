/// <reference types="node" />
import { existsSync, readdirSync, statSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PHOTOS, photoUrl, type PhotoName } from '@/lib/photos'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'
import { Photo, PhotoCredits } from './Photo'

const names = Object.keys(PHOTOS) as PhotoName[]

describe('the photo files', () => {
  it.each(names)('%s has an 800px and a 1600px version that exist and are real JPEGs', (name) => {
    for (const width of [800, 1600] as const) {
      const path = `public${photoUrl(name, width)}`
      expect(existsSync(path), path).toBe(true)
      expect(statSync(path).size, path).toBeGreaterThan(10_000) // not an error page saved as .jpg
      expect(statSync(path).size, path).toBeLessThan(1_000_000) // stays light on phones
    }
  })

  it('has no stray images that the app does not use', () => {
    const used = new Set(names.flatMap((n) => [800, 1600].map((w) => `${PHOTOS[n].file}-${w}.jpg`)))
    expect(readdirSync('public/images').filter((f) => !used.has(f))).toEqual([])
  })

  it('credits every photographer with a link to the photo on Unsplash', () => {
    for (const name of names) {
      expect(PHOTOS[name].photographer).toMatch(/\S/)
      expect(PHOTOS[name].url).toMatch(/^https:\/\/unsplash\.com\/photos\/[\w-]+$/)
    }
  })
})

describe('Photo', () => {
  it('is decorative by default, so screen readers skip it', () => {
    const { container } = render(<Photo name="chefPlating" />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('describes itself when given a description', () => {
    render(<Photo name="chefPlating" alt="A chef plating a dish" />)
    expect(screen.getByRole('img', { name: 'A chef plating a dish' })).toBeInTheDocument()
  })

  it('offers both sizes so phones download the small one', () => {
    const { container } = render(<Photo name="tableWine" />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/images/table-wine-800.jpg')
    expect(img.getAttribute('srcset')).toBe(
      '/images/table-wine-800.jpg 800w, /images/table-wine-1600.jpg 1600w',
    )
  })

  it('loads lazily unless it is the first thing on screen', () => {
    const { container, rerender } = render(<Photo name="tableWine" />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
    rerender(<Photo name="tableWine" priority />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager')
  })

  it('keeps its gradient and drops the image when the file fails to load', () => {
    const { container } = render(<Photo name="tableWine" className="h-10" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.firstElementChild?.className).toContain('bg-gradient-to-br')
  })

  it('puts content over the photo, with an overlay for legibility unless turned off', () => {
    const { container, rerender } = render(
      <Photo name="tableWine">
        <p>Over the photo</p>
      </Photo>,
    )
    expect(screen.getByText('Over the photo')).toBeInTheDocument()
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
    rerender(<Photo name="tableWine" scrim="none" />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
  })

  it('crops around the given focal point', () => {
    const { container } = render(<Photo name="loungeLamps" position="center 12%" />)
    expect(container.querySelector('img')).toHaveStyle({ objectPosition: 'center 12%' })
  })
})

describe('PhotoCredits', () => {
  it('names each photographer as a link that opens safely in a new tab', () => {
    render(<PhotoCredits names={['loungeLamps', 'chefPlating', 'tableWine']} />)
    const link = screen.getByRole('link', { name: /Leonardo Ziaja/ })
    expect(link).toHaveAttribute('href', PHOTOS.loungeLamps.url)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    const text = screen
      .getByText(/Photography on Unsplash:/)
      .textContent!.replaceAll(' (opens in a new tab)', '')
    expect(text).toBe(
      'Photography on Unsplash: Leonardo Ziaja, Urban Gyllström and Jay Wennington.',
    )
  })
})

describe('where the photographs appear', () => {
  const imgs = (container: Element) => container.querySelectorAll('img[src^="/images/"]')

  it.each([
    ['/rewards', 'lounge-lamps'],
    ['/invite', 'table-wine'],
    ['/join?ref=TFE-ABC234', 'chef-plating'],
    ['/signup', 'evening-tables'],
    ['/login', 'evening-tables'],
  ])('%s shows %s', async (path, file) => {
    const { container } = await renderApp(path, { repositories: createTestRepositories() })
    await screen.findByRole('heading', { level: 1 })
    expect([...imgs(container)].some((i) => i.getAttribute('src')!.includes(file))).toBe(true)
  })

  it('credits the photographers on the Rewards page', async () => {
    await renderApp('/rewards', { repositories: createTestRepositories() })
    expect(await screen.findByText(/Photography on Unsplash:/)).toBeInTheDocument()
    for (const name of names) {
      expect(
        screen.getByRole('link', { name: new RegExp(PHOTOS[name].photographer) }),
      ).toBeInTheDocument()
    }
  })

  it('welcomes a first-time user with a photo on the empty My Spots screen', async () => {
    const repositories = createTestRepositories()
    const seed = await repositories.restaurants.list()
    for (const r of seed) await repositories.restaurants.remove(r.id)
    const { container } = await renderApp('/', { repositories })
    await screen.findByRole('heading', { name: 'No spots yet' })
    expect(imgs(container)).toHaveLength(1)
  })
})
