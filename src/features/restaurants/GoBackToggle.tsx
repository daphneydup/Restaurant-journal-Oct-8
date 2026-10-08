import { Switch, useToast } from '@/components'
import { useAddToGoBack, useGoBackEntry, useRemoveFromGoBack } from '@/hooks/queries'
import { daysSince, durationLabel } from '@/lib/relativeTime'

/** "Go back" switch: flags a spot to revisit, so it appears on the Go-Back list. */
export function GoBackToggle({ restaurantId, now }: { restaurantId: string; now: Date }) {
  const { showToast } = useToast()
  const entry = useGoBackEntry(restaurantId)
  const add = useAddToGoBack()
  const remove = useRemoveFromGoBack()
  const busy = add.isPending || remove.isPending

  const fail = () =>
    showToast('We couldn’t update your Go-Back list. Please try again.', { tone: 'error' })

  function onChange(checked: boolean) {
    if (checked) {
      add.mutate(
        { restaurantId },
        { onSuccess: () => showToast('Added to your Go-Back list'), onError: fail },
      )
    } else if (entry.data) {
      remove.mutate(entry.data.id, {
        onSuccess: () => showToast('Removed from your Go-Back list'),
        onError: fail,
      })
    }
  }

  const saved = entry.data
  const days = saved ? daysSince(saved.addedAt, now) : 0
  const description = !saved
    ? 'Flag this spot to revisit.'
    : days === 0
      ? 'On your list since today.'
      : `On your list for ${durationLabel(days)}.`

  return (
    <Switch
      label="Go back"
      description={description}
      checked={Boolean(saved)}
      disabled={entry.isPending || busy}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}
