import { formatAverage, meetsFit } from '@/lib/dietFit'
import { cn } from '@/lib/cn'
import type { DietLens } from '@/types'
import { LensIcon } from './LensIcon'
import { VisuallyHidden } from './VisuallyHidden'

/**
 * "[icon] Vegan 4.3": how well one diet is served on average. The number carries the meaning;
 * the colour only reinforces whether it clears the "works for" bar.
 */
export function DietFitBadge({ lens, average }: { lens: DietLens; average: number }) {
  const works = meetsFit({ average })
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-semibold',
        works ? 'bg-basil-soft text-basil-strong' : 'bg-surface-sunken text-ink',
      )}
    >
      <LensIcon icon={lens.icon} className="size-3.5" />
      {lens.shortLabel}
      <span aria-hidden>{formatAverage(average)}</span>
      <VisuallyHidden>
        {' '}
        averages {formatAverage(average)} out of 5{works ? ', works well' : ', mixed results'}
      </VisuallyHidden>
    </span>
  )
}
