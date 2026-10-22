import { Carousel } from '@/components'
import { TESTIMONIALS, type Testimonial } from './testimonials'

function monogram(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Quote({ item }: { item: Testimonial }) {
  return (
    <figure className="flex flex-col items-center px-4 py-6 text-center md:px-12 md:py-8">
      <span aria-hidden className="font-display text-6xl leading-none text-primary">
        “
      </span>
      <blockquote className="font-display text-2xl leading-snug text-ink italic md:text-3xl">
        <p>{item.quote}</p>
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 text-left">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-pill border border-primary/60 font-display text-lg text-primary-strong"
        >
          {monogram(item.name)}
        </span>
        <span>
          <span className="block font-semibold">{item.name}</span>
          <span className="block text-sm text-ink-muted">{item.detail}</span>
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * What members say, as a carousel. The quotes are samples, and the label says so on screen: a
 * real review would need a real person's permission.
 */
export function TestimonialCarousel({
  heading = 'Around the table',
  items = TESTIMONIALS,
}: {
  heading?: string
  items?: readonly Testimonial[]
}) {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="rounded-card bg-surface p-4 shadow-card md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="testimonials-heading" className="text-xl">
          {heading}
        </h2>
        <p className="rounded-control border border-line-strong px-2 py-0.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Sample quotes
        </p>
      </div>
      <Carousel label="What members say" autoPlayMs={8000} className="mt-2">
        {items.map((item) => (
          <Quote key={item.id} item={item} />
        ))}
      </Carousel>
      <p className="mt-2 text-center text-xs text-ink-muted">
        Placeholder quotes from imagined members while we collect real stories.
      </p>
    </section>
  )
}
