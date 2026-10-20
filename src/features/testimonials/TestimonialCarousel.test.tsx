import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'
import { rememberReferral, forgetReferral } from '@/lib/pendingReferral'
import { TestimonialCarousel } from './TestimonialCarousel'
import { TESTIMONIALS } from './testimonials'

describe('TestimonialCarousel', () => {
  it('shows every quote as a labelled figure with who said it', () => {
    render(<TestimonialCarousel />)
    const region = screen.getByRole('region', { name: 'What members say' })
    expect(within(region).getAllByRole('group', { name: /^\d+ of \d+$/ })).toHaveLength(
      TESTIMONIALS.length,
    )
    for (const item of TESTIMONIALS) {
      expect(screen.getByText(item.quote)).toBeInTheDocument()
      expect(screen.getByText(item.name)).toBeInTheDocument()
    }
  })

  it('says on screen that these are sample quotes, so nobody mistakes them for real reviews', () => {
    render(<TestimonialCarousel />)
    expect(screen.getByText('Sample quotes')).toBeVisible()
    expect(screen.getByText(/Placeholder quotes from imagined members/)).toBeInTheDocument()
  })

  it('uses real, attributed quotes: each has text, a name and a detail', () => {
    for (const item of TESTIMONIALS) {
      expect(item.quote.length).toBeGreaterThan(30)
      expect(item.name).toMatch(/\S/)
      expect(item.detail).toMatch(/\S/)
    }
    expect(new Set(TESTIMONIALS.map((t) => t.id)).size).toBe(TESTIMONIALS.length)
  })
})

describe('where the carousel appears', () => {
  it.each(['/rewards', '/signup', '/join?ref=TFE-ABC234'])('on %s', async (path) => {
    await renderApp(path, { repositories: createTestRepositories() })
    expect(await screen.findByRole('region', { name: 'What members say' })).toBeInTheDocument()
    forgetReferral()
  })

  it('the sign-up page mentions a waiting invite only when there is one', async () => {
    forgetReferral()
    const first = await renderApp('/signup', { repositories: createTestRepositories() })
    await screen.findByRole('region', { name: 'What members say' })
    expect(screen.queryByText(/friend’s invite is waiting/)).not.toBeInTheDocument()
    first.unmount()

    rememberReferral('TFE-ABC234')
    await renderApp('/signup', { repositories: createTestRepositories() })
    expect(
      await screen.findByText(/friend’s invite is waiting: you’ll get 200 bonus points/),
    ).toBeInTheDocument()
    forgetReferral()
  })
})
