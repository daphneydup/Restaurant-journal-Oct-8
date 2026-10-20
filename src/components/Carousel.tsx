import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

/**
 * A swipeable carousel built on native scroll-snap (so touch swiping just works), with the
 * controls the WAI-ARIA carousel pattern asks for:
 *  - a labelled region, and every slide announced as "n of N"
 *  - previous / next buttons and a dot per slide (all 44px targets)
 *  - rotation that people can stop: it pauses on hover and on focus, has a Pause button, and
 *    never starts when the device asks for reduced motion
 * Slides that are off screen are `inert`, so keyboard and screen-reader users only meet the
 * slide they can see.
 */
export function Carousel({
  label,
  children,
  autoPlayMs,
  className,
}: {
  /** Names the region, e.g. "Member quotes". */
  label: string
  children: ReactNode
  /** Turns on automatic rotation, in milliseconds per slide. Omit for none. */
  autoPlayMs?: number
  className?: string
}) {
  const slides = Children.toArray(children)
  const count = slides.length
  const reducedMotion = usePrefersReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const settling = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)

  const canRotate = autoPlayMs !== undefined && count > 1 && !reducedMotion
  const rotating = canRotate && !userPaused && !hovering && !focusWithin

  useEffect(() => () => clearTimeout(settling.current), [])

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return
      const target = (next + count) % count
      setIndex(target)
      const el = scroller.current
      if (!el) return
      // While we scroll on purpose, ignore the scroll events so the dots don't flicker through
      // the slides in between.
      clearTimeout(settling.current)
      settling.current = setTimeout(() => (settling.current = undefined), reducedMotion ? 50 : 700)
      el.scrollTo({ left: target * el.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [count, reducedMotion],
  )

  // Rotation: one timer per slide, restarted whenever the slide changes or rotation toggles.
  useEffect(() => {
    if (!rotating || autoPlayMs === undefined) return
    const timer = setTimeout(() => goTo(index + 1), autoPlayMs)
    return () => clearTimeout(timer)
  }, [rotating, autoPlayMs, index, goTo])

  function onScroll(event: UIEvent<HTMLDivElement>) {
    if (settling.current !== undefined) return
    const el = event.currentTarget
    if (el.clientWidth === 0) return
    const nearest = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))
    setIndex((current) => (current === nearest ? current : nearest))
  }

  if (count === 0) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn('relative', className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false)
      }}
    >
      <div
        ref={scroller}
        onScroll={onScroll}
        // Live updates would interrupt people while it rotates by itself; only announce when
        // rotation is stopped and the change was their own.
        aria-live={rotating ? 'off' : 'polite'}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            inert={i !== index}
            className="w-full shrink-0 snap-center"
          >
            {slide}
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-between">
          <div className="flex items-center">
            <IconButton label="Previous quote" onClick={() => goTo(index - 1)}>
              <ChevronLeft aria-hidden className="size-5" />
            </IconButton>
            <IconButton label="Next quote" onClick={() => goTo(index + 1)}>
              <ChevronRight aria-hidden className="size-5" />
            </IconButton>
            {canRotate && (
              <IconButton
                label={userPaused ? 'Start automatic rotation' : 'Pause automatic rotation'}
                onClick={() => setUserPaused((paused) => !paused)}
              >
                {userPaused ? (
                  <Play aria-hidden className="size-4" />
                ) : (
                  <Pause aria-hidden className="size-4" />
                )}
              </IconButton>
            )}
          </div>
          <ul aria-label="Choose a quote" className="flex items-center">
            {slides.map((_, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-label={`Show quote ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => goTo(i)}
                  className="flex size-touch items-center justify-center"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'block h-1.5 rounded-pill transition-all',
                      i === index ? 'w-6 bg-primary' : 'w-1.5 bg-line-strong',
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
