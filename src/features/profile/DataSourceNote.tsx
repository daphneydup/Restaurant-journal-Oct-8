import { Cloud, HardDrive } from 'lucide-react'
import { Card } from '@/components'
import { useRepositories } from '@/data/repositoryContext'

/** Says where the data lives, so there is never doubt about whether it is being saved for real. */
export function DataSourceNote() {
  const { kind } = useRepositories()
  const Icon = kind === 'supabase' ? Cloud : HardDrive
  return (
    <Card className="flex items-start gap-3">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-basil-strong" />
      <div>
        <h2 className="font-sans text-base font-semibold">
          {kind === 'supabase' ? 'Saved to your Supabase project' : 'Demo data on this device'}
        </h2>
        <p className="text-sm text-ink-muted">
          {kind === 'supabase'
            ? 'Everything you log is stored in your project and tied to this browser’s anonymous session.'
            : 'Nothing leaves this browser. Add your Supabase key to .env.local to save for real.'}
        </p>
      </div>
    </Card>
  )
}
