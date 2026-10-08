import { MapPin, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Chip, Combobox, TextField, type ComboboxOption } from '@/components'
import { formatPriceTier } from '@/lib/format'
import type { Restaurant } from '@/types'
import { FIELD_IDS } from './fieldIds'
import type { LogVisitFormValues } from './logVisitSchema'

export type RestaurantChoice = LogVisitFormValues['restaurant']

const NEW_SPOT_ID = '__new__'
const MAX_OPTIONS = 6

/**
 * Step one of logging a visit: search your saved spots, or add a new one by name and
 * neighborhood. Three states: searching, a spot chosen, or adding a new spot.
 */
export function RestaurantPicker({
  value,
  onChange,
  restaurants,
  neighborhoods,
  errors,
  newSpotExtras,
}: {
  value: RestaurantChoice
  onChange: (choice: RestaurantChoice, picked?: Restaurant) => void
  restaurants: readonly Restaurant[]
  /** Neighborhood suggestions shown as chips when adding a new spot. */
  neighborhoods: readonly string[]
  errors: {
    restaurant?: string | undefined
    name?: string | undefined
    neighborhood?: string | undefined
  }
  /** Rendered inside the "new spot" block (the price tier lives here for new spots). */
  newSpotExtras?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)

  /**
   * The control the user just pressed disappears when the picker changes state, which would
   * drop keyboard focus onto the page. Handlers say where focus should go next, and this effect
   * moves it once the new state has rendered.
   */
  const focusNext = useRef<'field' | 'change' | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    const element =
      target === 'change'
        ? root.current?.querySelector<HTMLElement>('[data-restaurant-change]')
        : document.getElementById(FIELD_IDS.restaurant)
    element?.focus()
  })

  function change(choice: RestaurantChoice, next: 'field' | 'change', picked?: Restaurant) {
    focusNext.current = next
    onChange(choice, picked)
  }

  return <div ref={root}>{content()}</div>

  function content() {
    if (value.mode === 'new') return newSpotForm(value)

    const chosen = value.restaurantId
      ? restaurants.find((r) => r.id === value.restaurantId)
      : undefined
    if (chosen) return chosenSpot(chosen)

    return search()
  }

  function newSpotForm(spot: Extract<RestaurantChoice, { mode: 'new' }>) {
    const typed = spot.neighborhood.trim().toLowerCase()
    const suggestions = neighborhoods.filter((n) => n.toLowerCase().includes(typed)).slice(0, 8)
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-basil-strong">
          <Plus aria-hidden className="size-4" /> Adding a new spot
        </p>
        <TextField
          id={FIELD_IDS.restaurant}
          label="Restaurant name"
          value={spot.name}
          error={errors.name}
          autoComplete="off"
          onChange={(event) => onChange({ ...spot, name: event.target.value })}
        />
        <div>
          <TextField
            id={FIELD_IDS.neighborhood}
            label="Neighborhood"
            value={spot.neighborhood}
            error={errors.neighborhood}
            autoComplete="off"
            onChange={(event) => onChange({ ...spot, neighborhood: event.target.value })}
          />
          {suggestions.length > 0 && (
            <div
              role="group"
              aria-label="Suggested neighborhoods"
              className="mt-2 flex flex-wrap gap-2"
            >
              {suggestions.map((name) => (
                <Chip
                  key={name}
                  selected={spot.neighborhood.trim().toLowerCase() === name.toLowerCase()}
                  onClick={() => onChange({ ...spot, neighborhood: name })}
                >
                  {name}
                </Chip>
              ))}
            </div>
          )}
        </div>
        {newSpotExtras}
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => {
            setQuery(spot.name)
            change({ mode: 'existing', restaurantId: '' }, 'field')
          }}
        >
          Search saved spots instead
        </Button>
      </div>
    )
  }

  function chosenSpot(spot: Restaurant) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card bg-basil-soft p-4">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-basil-strong">
            {spot.name}
          </p>
          <p className="flex items-center gap-1 text-sm text-ink">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {spot.neighborhood} · {formatPriceTier(spot.priceTier)}
          </p>
        </div>
        <Button
          variant="secondary"
          data-restaurant-change
          aria-label={`Change restaurant, currently ${spot.name}`}
          onClick={() => {
            setQuery('')
            change({ mode: 'existing', restaurantId: '' }, 'field')
          }}
        >
          Change
        </Button>
      </div>
    )
  }

  function search() {
    const needle = query.trim().toLowerCase()
    const matches = restaurants
      .filter((r) => needle === '' || `${r.name} ${r.neighborhood}`.toLowerCase().includes(needle))
      .slice(0, MAX_OPTIONS)
    const options: ComboboxOption[] = matches.map((r) => ({
      id: r.id,
      label: r.name,
      description: `${r.neighborhood} · ${formatPriceTier(r.priceTier)}`,
    }))
    if (needle !== '') {
      options.push({
        id: NEW_SPOT_ID,
        label: `Add “${query.trim()}” as a new spot`,
        description: 'Not in your saved spots yet',
        icon: <Plus aria-hidden className="size-5 text-basil-strong" />,
      })
    }

    return (
      <Combobox
        id={FIELD_IDS.restaurant}
        label="Restaurant"
        placeholder="Search or add a spot"
        value={query}
        onValueChange={setQuery}
        options={options}
        error={errors.restaurant}
        onSelect={(option) => {
          if (option.id === NEW_SPOT_ID) {
            change({ mode: 'new', name: query.trim(), neighborhood: '' }, 'field')
            return
          }
          const picked = restaurants.find((r) => r.id === option.id)
          if (picked) change({ mode: 'existing', restaurantId: picked.id }, 'change', picked)
        }}
      />
    )
  }
}
