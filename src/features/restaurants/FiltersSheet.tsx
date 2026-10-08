import { Button, Chip, Dialog, LensIcon, Switch } from '@/components'
import { formatPriceTier, PRICE_TIER_LABELS } from '@/lib/format'
import { PRICE_TIERS, type DietLens, type PriceTier } from '@/types'
import { EMPTY_FILTERS, countActiveFilters, type SpotFilters } from './spots'

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** Diet, price, neighborhood and go-back filters. Changes apply live; "Done" just closes. */
export function FiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  lenses,
  neighborhoods,
  resultCount,
}: {
  open: boolean
  onClose: () => void
  filters: SpotFilters
  onChange: (filters: SpotFilters) => void
  lenses: readonly DietLens[]
  neighborhoods: readonly string[]
  resultCount: number
}) {
  const active = countActiveFilters(filters)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filters"
      variant="sheet"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            disabled={active === 0}
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
          >
            Clear filters
          </Button>
          <Button onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'spot' : 'spots'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="mb-2 font-semibold">Works for</legend>
          <div className="flex flex-wrap gap-2">
            {lenses.map((lens) => (
              <Chip
                key={lens.id}
                selected={filters.lensIds.includes(lens.id)}
                icon={<LensIcon icon={lens.icon} />}
                onClick={() => onChange({ ...filters, lensIds: toggle(filters.lensIds, lens.id) })}
              >
                {lens.shortLabel}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Spots must work well for every diet you pick.
          </p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-semibold">Price</legend>
          <div className="flex flex-wrap gap-2">
            {PRICE_TIERS.map((tier: PriceTier) => (
              <Chip
                key={tier}
                selected={filters.priceTiers.includes(tier)}
                aria-label={`${formatPriceTier(tier)}, ${PRICE_TIER_LABELS[tier].toLowerCase()}`}
                onClick={() =>
                  onChange({ ...filters, priceTiers: toggle(filters.priceTiers, tier) })
                }
              >
                {formatPriceTier(tier)}
              </Chip>
            ))}
          </div>
        </fieldset>

        {neighborhoods.length > 0 && (
          <fieldset>
            <legend className="mb-2 font-semibold">Neighborhood</legend>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((name) => (
                <Chip
                  key={name}
                  selected={filters.neighborhood === name}
                  onClick={() =>
                    onChange({
                      ...filters,
                      neighborhood: filters.neighborhood === name ? '' : name,
                    })
                  }
                >
                  {name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}

        <Switch
          label="Only my Go-Back list"
          description="Spots you’ve flagged to revisit."
          checked={filters.goBackOnly}
          onChange={(event) => onChange({ ...filters, goBackOnly: event.target.checked })}
        />
      </div>
    </Dialog>
  )
}
