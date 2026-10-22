import { Ticket } from 'lucide-react'
import { Button } from '@/components'
import { cn } from '@/lib/cn'
import { voucherState } from '@/lib/rewardRules'
import type { Voucher } from '@/types'
import { CATEGORY_META, formatDay } from './rewardMeta'

export function VoucherCard({
  voucher,
  now,
  onUse,
  busy,
}: {
  voucher: Voucher
  now: Date
  onUse: (voucher: Voucher) => void
  busy: boolean
}) {
  const state = voucherState(voucher, now)
  const { label } = CATEGORY_META[voucher.category]
  const live = state === 'active'
  return (
    <li
      className={cn(
        'rounded-card border border-dashed p-5',
        live ? 'border-primary/60 bg-primary-soft' : 'border-line bg-surface opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary-strong uppercase">
            <Ticket aria-hidden className="size-4" /> {label}
          </p>
          <h3 className="mt-1 text-lg">{voucher.title}</h3>
          <p className="text-sm text-ink-muted">{voucher.partner}</p>
        </div>
        {!live && (
          <span className="rounded-control bg-surface-sunken px-2 py-1 text-xs font-semibold tracking-wider text-ink uppercase">
            {state === 'used' ? 'Used' : 'Expired'}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-muted">Voucher code</p>
      <p
        className={cn(
          'font-mono text-xl tracking-[0.14em] whitespace-nowrap',
          live ? 'text-ink' : 'text-ink-muted line-through',
        )}
      >
        {voucher.code}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {state === 'used' && voucher.usedAt
            ? `Used ${formatDay(voucher.usedAt)}`
            : state === 'expired'
              ? `Expired ${formatDay(voucher.expiresAt)}`
              : `Valid until ${formatDay(voucher.expiresAt)}`}
        </p>
        {live && (
          <Button
            variant="secondary"
            disabled={busy}
            aria-label={`Mark ${voucher.title} as used`}
            onClick={() => onUse(voucher)}
          >
            Mark as used
          </Button>
        )}
      </div>
    </li>
  )
}
