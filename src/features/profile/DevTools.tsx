import { useState } from 'react'
import { Button, Card, ConfirmDialog, Switch, useToast } from '@/components'
import { useDevControls, useResetDemoData } from '@/hooks/queries'

/**
 * Only shown with the mock data layer. Lets you restore the demo data and rehearse the error
 * screens. A real back end provides no dev controls, so this section simply disappears.
 */
export function DevTools() {
  const dev = useDevControls()
  const reset = useResetDemoData()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [simulating, setSimulating] = useState(() => dev?.isSimulatingErrors() ?? false)

  if (!dev) return null

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl">Demo data</h2>
        <p className="text-ink-muted">
          Tools for trying the app out. Nothing here leaves this device.
        </p>
      </div>

      <Switch
        label="Simulate network errors"
        description="Every screen will show its error state until you turn this off."
        checked={simulating}
        onChange={(event) => {
          dev.setSimulateErrors(event.target.checked)
          setSimulating(event.target.checked)
        }}
      />

      <div>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Reset demo data
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Reset demo data?"
        confirmLabel="Reset data"
        busy={reset.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              setConfirming(false)
              showToast('Demo data restored')
            },
            onError: () =>
              showToast('We couldn’t reset the data. Please try again.', { tone: 'error' }),
          })
        }
      >
        <p>
          Everything you’ve logged is replaced with the original sample spots. This can’t be undone.
        </p>
      </ConfirmDialog>
    </Card>
  )
}
