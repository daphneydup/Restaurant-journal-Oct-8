import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WorkedForEveryone } from '@/types'

const CONFIG = {
  yes: { Icon: CircleCheck, text: 'Worked for everyone', tone: 'text-basil-strong' },
  maybe: { Icon: CircleHelp, text: 'Mixed for the group', tone: 'text-saffron-strong' },
  no: { Icon: CircleX, text: 'Didn’t work for everyone', tone: 'text-danger' },
} as const

/** Icon + words for the yes / maybe / no verdict, so it never relies on colour alone. */
export function WorkedBadge({
  value,
  className,
}: {
  value: WorkedForEveryone
  className?: string
}) {
  const { Icon, text, tone } = CONFIG[value]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', tone, className)}>
      <Icon aria-hidden className="size-4" />
      {text}
    </span>
  )
}
