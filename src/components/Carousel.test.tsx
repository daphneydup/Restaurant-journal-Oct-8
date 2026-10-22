import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Carousel } from './Carousel'

function mockMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const slides = ['One', 'Two', 'Three']
function setup(props: { autoPlayMs?: number } = {}) {
  return render(
    <Carousel label="Member quotes" {...props}>
      {slides.map((s) => (
        <p key={s}>{s}</p>
      ))}
    </Carousel>,
  )
}

const slide = (n: number) => screen.getByRole('group', { name: `${n} of 3` })
const isActive = (n: number) => !slide(n).hasAttribute('inert')

let scrollTo: ReturnType<typeof vi.fn>
beforeEach(() => {
  mockMotion(false)
  scrollTo = vi.fn()
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo
})
afterEach(() => {
  vi.useRealTimers()
  // @ts-expect-error restore jsdom's lack of matchMedia
  delete window.matchMedia
})

describe('Carousel structure', () => {
  it('is a labelled carousel whose slides are announced as "n of N"', () => {
    setup()
    const region = screen.getByRole('region', { name: 'Member quotes' })
    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    for (const n of [1, 2, 3]) {
      expect(slide(n)).toHaveAttribute('aria-roledescription', 'slide')
    }
  })

  it('only lets people reach the slide they can see', () => {
    setup()
    expect([isActive(1), isActive(2), isActive(3)]).toEqual([true, false, false])
  })

  it('renders nothing for no slides, and no controls for a single slide', () => {
    const { container, rerender } = render(<Carousel label="Empty">{[]}</Carousel>)
    expect(container).toBeEmptyDOMElement()
    rerender(
      <Carousel label="One">
        <p>Only</p>
      </Carousel>,
    )
    expect(screen.queryByRole('button', { name: 'Next quote' })).not.toBeInTheDocument()
  })
})

describe('Carousel controls', () => {
  it('moves forward and back, wrapping around at both ends', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Next quote' }))
    expect(isActive(2)).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Previous quote' }))
    await user.click(screen.getByRole('button', { name: 'Previous quote' }))
    expect(isActive(3)).toBe(true) // wrapped from the first to the last
    await user.click(screen.getByRole('button', { name: 'Next quote' }))
    expect(isActive(1)).toBe(true) // and back around
  })

  it('has a dot per slide that jumps there and marks the current one', async () => {
    const user = userEvent.setup()
    setup()
    const dots = within(screen.getByRole('list', { name: 'Choose a quote' })).getAllByRole('button')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveAttribute('aria-current', 'true')
    await user.click(dots[2]!)
    expect(isActive(3)).toBe(true)
    expect(dots[2]).toHaveAttribute('aria-current', 'true')
    expect(dots[0]).not.toHaveAttribute('aria-current')
  })

  it('scrolls the track to the chosen slide', async () => {
    const user = userEvent.setup()
    setup()
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 })
    await user.click(screen.getByRole('button', { name: 'Next quote' }))
    expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' })
    // @ts-expect-error remove the test override
    delete HTMLElement.prototype.clientWidth
  })

  it('follows the person’s own swipe', () => {
    setup()
    const track = slide(1).parentElement!
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 })
    track.scrollLeft = 600
    fireEvent.scroll(track)
    expect(isActive(3)).toBe(true)
  })

  it('ignores scroll events caused by its own smooth scroll, then follows swipes again', () => {
    vi.useFakeTimers()
    setup()
    const track = slide(1).parentElement!
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 })

    fireEvent.click(screen.getByRole('button', { name: 'Next quote' }))
    track.scrollLeft = 0 // the scroll hasn't moved yet: this must not snap the dots back
    fireEvent.scroll(track)
    expect(isActive(2)).toBe(true)

    act(() => vi.advanceTimersByTime(800)) // the scroll has finished
    track.scrollLeft = 600
    fireEvent.scroll(track)
    expect(isActive(3)).toBe(true)
  })

  it('makes every control a full-size touch target', () => {
    setup({ autoPlayMs: 5000 })
    for (const name of [
      'Previous quote',
      'Next quote',
      'Pause automatic rotation',
      'Show quote 1',
    ]) {
      const button = screen.getByRole('button', { name })
      expect(button.className + (button.firstElementChild?.parentElement?.className ?? '')).toMatch(
        /size-touch/,
      )
    }
  })
})

describe('Carousel rotation', () => {
  beforeEach(() => vi.useFakeTimers())

  it('does not rotate unless asked to', () => {
    setup()
    act(() => vi.advanceTimersByTime(60_000))
    expect(isActive(1)).toBe(true)
    expect(screen.queryByRole('button', { name: /automatic rotation/ })).not.toBeInTheDocument()
  })

  it('advances on its own and wraps', () => {
    setup({ autoPlayMs: 5000 })
    act(() => vi.advanceTimersByTime(5000))
    expect(isActive(2)).toBe(true)
    act(() => vi.advanceTimersByTime(5000))
    expect(isActive(3)).toBe(true)
    act(() => vi.advanceTimersByTime(5000))
    expect(isActive(1)).toBe(true)
  })

  it('stops when paused, and carries on when restarted', () => {
    setup({ autoPlayMs: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Pause automatic rotation' }))
    act(() => vi.advanceTimersByTime(30_000))
    expect(isActive(1)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Start automatic rotation' }))
    act(() => vi.advanceTimersByTime(5000))
    expect(isActive(2)).toBe(true)
  })

  it('holds still while the pointer is over it or focus is inside it', () => {
    setup({ autoPlayMs: 5000 })
    const region = screen.getByRole('region', { name: 'Member quotes' })

    fireEvent.mouseEnter(region)
    act(() => vi.advanceTimersByTime(20_000))
    expect(isActive(1)).toBe(true)
    fireEvent.mouseLeave(region)
    act(() => vi.advanceTimersByTime(5000))
    expect(isActive(2)).toBe(true)

    act(() => screen.getByRole('button', { name: 'Next quote' }).focus())
    expect(isActive(2)).toBe(true) // focus alone doesn't move it
    act(() => vi.advanceTimersByTime(20_000))
    expect(isActive(2)).toBe(true)
    act(() => screen.getByRole('button', { name: 'Next quote' }).blur())
    act(() => vi.advanceTimersByTime(5000))
    expect(isActive(3)).toBe(true)
  })

  it('does not announce changes while it rotates itself, but does once stopped', () => {
    setup({ autoPlayMs: 5000 })
    const track = slide(1).parentElement!
    expect(track).toHaveAttribute('aria-live', 'off')
    fireEvent.click(screen.getByRole('button', { name: 'Pause automatic rotation' }))
    expect(track).toHaveAttribute('aria-live', 'polite')
  })

  it('never rotates, and offers no pause button, when the device asks for reduced motion', () => {
    mockMotion(true)
    setup({ autoPlayMs: 5000 })
    act(() => vi.advanceTimersByTime(60_000))
    expect(isActive(1)).toBe(true)
    expect(screen.queryByRole('button', { name: /automatic rotation/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next quote' }))
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('restarts its timer after a manual change instead of skipping straight on', () => {
    setup({ autoPlayMs: 5000 })
    act(() => vi.advanceTimersByTime(4000))
    fireEvent.click(screen.getByRole('button', { name: 'Next quote' }))
    expect(isActive(2)).toBe(true)
    act(() => vi.advanceTimersByTime(4000)) // 4s since the click: not yet
    expect(isActive(2)).toBe(true)
    act(() => vi.advanceTimersByTime(1000))
    expect(isActive(3)).toBe(true)
  })
})
