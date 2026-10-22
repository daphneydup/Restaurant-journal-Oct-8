import { cn } from '@/lib/cn'
import type { PointsEntry } from '@/types'
import { formatDay, formatPoints } from './rewardMeta'

export function PointsHistory({ entries }: { entries: readonly PointsEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No points yet. Log a visit to earn your first.</p>
  }
  return (
    <ol aria-label="Points history" className="flex flex-col divide-y divide-line">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate">{entry.label}</p>
            <p className="text-xs text-ink-muted">{formatDay(entry.createdAt)}</p>
          </div>
          <p
            className={cn(
              'shrink-0 font-semibold tabular-nums',
              entry.points > 0 ? 'text-basil-strong' : 'text-ink-muted',
            )}
          >
            <span aria-hidden>{entry.points > 0 ? '+' : '−'}</span>
            {formatPoints(Math.abs(entry.points))}
            <span className="sr-only"> {entry.points > 0 ? 'points earned' : 'points spent'}</span>
          </p>
        </li>
      ))}
    </ol>
  )
}
