import { LIMITS, POINTS } from '@/lib/rewardRules'

/** The rules, written from the same constants the engine uses, so the text can't drift. */
export function HowYouEarn() {
  const items = [
    {
      title: 'Log a visit',
      body: `${POINTS.visit} points for every visit you log, plus ${POINTS.note} for a note and ${POINTS.photo} for a photo.`,
    },
    {
      title: 'Invite a friend',
      body: `${POINTS.referral} points for you and ${POINTS.referral} for them when they join with your link.`,
    },
    {
      title: 'The small print',
      body: `Up to ${LIMITS.visitsPerDay} visits a day earn points, and only the first visit to each restaurant that day.`,
    },
  ]
  return (
    <section aria-labelledby="earn-heading">
      <h2 id="earn-heading" className="mb-3 text-xl">
        How you earn
      </h2>
      <dl className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-card bg-surface p-5 shadow-card">
            <dt className="font-display text-lg">{item.title}</dt>
            <dd className="mt-1 text-sm text-ink-muted">{item.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
