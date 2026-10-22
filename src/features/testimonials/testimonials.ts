/**
 * SAMPLE quotes. They are written as placeholders so the screens can be designed and tested, and
 * are shown with a visible "Sample quotes" label. The people are fictional. Replace this list
 * (and drop the label in TestimonialCarousel) when real member stories are collected with
 * permission.
 */
export interface Testimonial {
  id: string
  quote: string
  name: string
  /** Shown under the name, e.g. their diet and city. */
  detail: string
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    id: 't1',
    quote:
      'We stopped arguing about where to eat. One look at the diet ratings and the whole table agrees.',
    name: 'Maya R.',
    detail: 'Vegan, Dallas',
  },
  {
    id: 't2',
    quote:
      'My steak-loving husband and I finally have a shortlist that feels like a date night for both of us.',
    name: 'Priya S.',
    detail: 'Vegetarian, Uptown',
  },
  {
    id: 't3',
    quote:
      'Logging a visit takes less time than waiting for the check. The points on top are a lovely surprise.',
    name: 'Daniel O.',
    detail: 'Gluten-free, Bishop Arts',
  },
  {
    id: 't4',
    quote:
      'I planned my sister’s birthday dinner in two minutes. Every one of us had something wonderful to order.',
    name: 'Chloé B.',
    detail: 'Pescatarian, Knox-Henderson',
  },
  {
    id: 't5',
    quote:
      'Redeeming points for a dessert at a place we already loved made the whole evening feel a little more special.',
    name: 'Marcus T.',
    detail: 'Dairy-free, Deep Ellum',
  },
]
