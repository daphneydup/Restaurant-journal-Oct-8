import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm, useWatch, type PathValue, type Resolver } from 'react-hook-form'
import { useNavigate } from 'react-router'
import {
  Button,
  Chip,
  Disclosure,
  PriceTierPicker,
  SegmentedControl,
  Spinner,
  Switch,
  TextArea,
  TextField,
  useToast,
} from '@/components'
import { isRepositoryError } from '@/data'
import { useLogVisit } from '@/hooks/queries'
import { DALLAS_NEIGHBORHOODS } from '@/lib/constants'
import { addDays, toISODate } from '@/lib/dates'
import type { DietLens, PriceTier, RatingValue, Restaurant } from '@/types'
import { CompanionsInput } from './CompanionsInput'
import { DishQuickAdd } from './DishQuickAdd'
import { ErrorSummary } from './ErrorSummary'
import { FIELD_IDS } from './fieldIds'
import { buildErrorSummary, messageAt } from './formErrors'
import {
  createDefaultValues,
  createLogVisitFormSchema,
  MAX_DISHES,
  MAX_NOTE_LENGTH,
  MAX_PHOTOS,
  toLogVisitInput,
  type LogVisitFormValues,
  type ValidLogVisitValues,
} from './logVisitSchema'
import { PartyAndRatings } from './PartyAndRatings'
import { PhotoPicker } from './PhotoPicker'
import { RestaurantPicker, type RestaurantChoice } from './RestaurantPicker'
import { suggestWorkedForEveryone } from './suggestWorkedForEveryone'

const WORKED_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
] as const

const WORTH_IT_OPTIONS = [
  { value: 'yes', label: 'Worth it' },
  { value: 'no', label: 'Not really' },
] as const

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-card bg-surface p-4 shadow-card md:p-5">
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  )
}

export function LogVisitForm({
  lenses,
  restaurants,
  defaultLensIds,
  homeCity,
  initialRestaurantId,
}: {
  lenses: readonly DietLens[]
  restaurants: readonly Restaurant[]
  /** Diets pre-selected from the profile. */
  defaultLensIds: readonly string[]
  homeCity: string
  initialRestaurantId?: string | undefined
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const logVisit = useLogVisit()

  const today = useMemo(() => toISODate(new Date()), [])
  const yesterday = useMemo(() => toISODate(addDays(new Date(), -1)), [])
  const schema = useMemo(() => createLogVisitFormSchema(today), [today])
  const neighborhoods = useMemo(
    () =>
      [...new Set([...DALLAS_NEIGHBORHOODS, ...restaurants.map((r) => r.neighborhood)])].sort(
        (a, b) => a.localeCompare(b),
      ),
    [restaurants],
  )
  const lensOrder = useMemo(() => new Map(lenses.map((lens, index) => [lens.id, index])), [lenses])

  const initialRestaurant = restaurants.find((r) => r.id === initialRestaurantId)
  const form = useForm<LogVisitFormValues, unknown, ValidLogVisitValues>({
    // The schema's output requires ratings and an answer; while typing, both can be unset.
    // The resolver only ever returns values the schema accepted, so this widening is safe.
    resolver: zodResolver(schema) as unknown as Resolver<
      LogVisitFormValues,
      unknown,
      ValidLogVisitValues
    >,
    defaultValues: createDefaultValues({
      today,
      lensIds: defaultLensIds.filter((id) => lensOrder.has(id)),
      ...(initialRestaurant && {
        restaurantId: initialRestaurant.id,
        priceTier: initialRestaurant.priceTier,
      }),
    }),
    reValidateMode: 'onChange',
  })

  // useWatch types its result as deeply partial, but `createDefaultValues` populates every field,
  // so the live values always have the full shape.
  const values = useWatch({ control: form.control }) as LogVisitFormValues
  const { errors, isSubmitted, submitCount, dirtyFields } = form.formState
  const [moreOpen, setMoreOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [restaurantConflict, setRestaurantConflict] = useState<string | undefined>()
  /** Once the user answers "worked for everyone?" themselves, we stop suggesting. */
  const [workedChosenByUser, setWorkedChosenByUser] = useState(false)

  function set<K extends keyof LogVisitFormValues>(name: K, value: LogVisitFormValues[K]) {
    form.setValue(name, value as PathValue<LogVisitFormValues, K>, {
      shouldDirty: true,
      shouldValidate: isSubmitted,
    })
  }

  function suggestFrom(ratings: LogVisitFormValues['ratings']) {
    if (workedChosenByUser) return
    const rated = ratings.flatMap((r) => (r.rating ? [r.rating] : []))
    set('workedForEveryone', suggestWorkedForEveryone(rated))
  }

  function onRestaurantChange(choice: RestaurantChoice, picked?: Restaurant) {
    setRestaurantConflict(undefined)
    set('restaurant', choice)
    // A known spot brings its usual price, unless the user already set one.
    if (picked && !dirtyFields.priceTier) form.setValue('priceTier', picked.priceTier)
  }

  function toggleLens(lensId: string) {
    const present = values.ratings.some((r) => r.lensId === lensId)
    const next = present
      ? values.ratings.filter((r) => r.lensId !== lensId)
      : [...values.ratings, { lensId, rating: undefined }].sort(
          (a, b) => (lensOrder.get(a.lensId) ?? 0) - (lensOrder.get(b.lensId) ?? 0),
        )
    set('ratings', next)
    suggestFrom(next)
  }

  function rate(lensId: string, rating: RatingValue) {
    const next = values.ratings.map((r) => (r.lensId === lensId ? { ...r, rating } : r))
    set('ratings', next)
    suggestFrom(next)
  }

  const ratedLensIds = values.ratings.map((r) => r.lensId)
  const summary = buildErrorSummary(errors, { ratedLensIds, lenses })
  const ratingErrors = Object.fromEntries(
    ratedLensIds.map((lensId, index) => [lensId, messageAt(errors, ['ratings', index, 'rating'])]),
  )
  const atTable = lenses.filter((lens) => ratedLensIds.includes(lens.id))

  const priceTier = (
    <PriceTierPicker
      legend={values.restaurant.mode === 'new' ? 'Usual price' : 'Price this time'}
      value={values.priceTier}
      onChange={(tier: PriceTier) => set('priceTier', tier)}
    />
  )

  async function onValid(valid: ValidLogVisitValues) {
    setSubmitError(null)
    try {
      const result = await logVisit.mutateAsync(toLogVisitInput(valid, { city: homeCity }))
      showToast(`Visit saved at ${result.restaurant.name}`)
      void navigate(`/spots/${result.restaurant.id}`)
    } catch (error) {
      if (isRepositoryError(error) && error.code === 'conflict') {
        setRestaurantConflict('That spot is already saved. Search for it instead.')
        setSubmitError(
          'That restaurant is already in your spots. Search for it by name to log this visit.',
        )
      } else if (isRepositoryError(error) && error.code === 'storage_full') {
        setSubmitError(
          'There isn’t enough space on this device to save that. Try removing a photo.',
        )
      } else {
        setSubmitError('We couldn’t save your visit. Check your connection and try again.')
      }
    }
  }

  function onInvalid(failed: typeof errors) {
    if (failed.note || failed.photoUrls) setMoreOpen(true)
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(onValid, onInvalid)(event)}
      className="flex flex-col gap-5"
    >
      <ErrorSummary errors={summary} attempt={submitCount} />

      <FormSection title="Where & when">
        <RestaurantPicker
          value={values.restaurant}
          onChange={onRestaurantChange}
          restaurants={restaurants}
          neighborhoods={neighborhoods}
          errors={{
            restaurant: restaurantConflict ?? messageAt(errors, ['restaurant', 'restaurantId']),
            name: restaurantConflict ?? messageAt(errors, ['restaurant', 'name']),
            neighborhood: messageAt(errors, ['restaurant', 'neighborhood']),
          }}
          newSpotExtras={priceTier}
        />
        <div>
          <TextField
            id={FIELD_IDS.date}
            type="date"
            label="Date"
            max={today}
            value={values.date}
            error={messageAt(errors, ['date'])}
            onChange={(event) => set('date', event.target.value)}
          />
          <div role="group" aria-label="Quick dates" className="mt-2 flex gap-2">
            <Chip selected={values.date === today} onClick={() => set('date', today)}>
              Today
            </Chip>
            <Chip selected={values.date === yesterday} onClick={() => set('date', yesterday)}>
              Yesterday
            </Chip>
          </div>
        </div>
      </FormSection>

      <FormSection title="How did it go?">
        <PartyAndRatings
          lenses={lenses}
          ratings={values.ratings}
          onToggleLens={toggleLens}
          onRate={rate}
          listError={messageAt(errors, ['ratings']) ?? messageAt(errors, ['ratings', 'root'])}
          ratingErrors={ratingErrors}
        />
        <div id={FIELD_IDS.worked}>
          <SegmentedControl
            legend="Did it work for everyone?"
            options={WORKED_OPTIONS}
            value={values.workedForEveryone}
            onChange={(value) => {
              setWorkedChosenByUser(true)
              set('workedForEveryone', value)
            }}
          />
          {messageAt(errors, ['workedForEveryone']) ? (
            <p className="mt-1 text-sm font-medium text-danger">
              {messageAt(errors, ['workedForEveryone'])}
            </p>
          ) : (
            values.workedForEveryone &&
            !workedChosenByUser && (
              <p className="mt-1 text-sm text-ink-muted">
                Suggested from your ratings. Tap to change.
              </p>
            )
          )}
        </div>
      </FormSection>

      <Disclosure
        label="More details"
        description="Price, dishes, photos, notes"
        open={moreOpen}
        onOpenChange={setMoreOpen}
      >
        {values.restaurant.mode === 'existing' && priceTier}
        <SegmentedControl
          legend="Worth the price? (optional)"
          options={WORTH_IT_OPTIONS}
          value={values.worthIt}
          onChange={(value) => set('worthIt', value)}
        />
        <DishQuickAdd
          dishes={values.dishes}
          onChange={(dishes) => set('dishes', dishes)}
          lenses={atTable}
          max={MAX_DISHES}
        />
        <div id={FIELD_IDS.photos}>
          <PhotoPicker
            photos={values.photoUrls}
            onChange={(photos) => set('photoUrls', photos)}
            max={MAX_PHOTOS}
            error={messageAt(errors, ['photoUrls'])}
          />
        </div>
        <TextArea
          id={FIELD_IDS.note}
          label="Note (optional)"
          maxLength={MAX_NOTE_LENGTH}
          value={values.note}
          error={messageAt(errors, ['note'])}
          onChange={(event) => set('note', event.target.value)}
        />
        <CompanionsInput names={values.companions} onChange={(names) => set('companions', names)} />
        <Switch
          label="Add to my Go-Back list"
          description="Keep it handy for the next time you’re deciding where to go."
          checked={values.addToGoBack}
          onChange={(event) => set('addToGoBack', event.target.checked)}
        />
      </Disclosure>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-card md:border">
        {submitError && (
          <p role="alert" className="mb-2 text-sm font-medium text-danger">
            {submitError}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full disabled:opacity-90"
          disabled={logVisit.isPending}
          aria-busy={logVisit.isPending}
        >
          {logVisit.isPending ? (
            <>
              <Spinner label="Saving" className="text-on-primary" /> Saving…
            </>
          ) : (
            'Save visit'
          )}
        </Button>
      </div>
    </form>
  )
}
