import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Button, Card, Chip, LensIcon, Spinner, TextField, useToast } from '@/components'
import { useUpdateProfile } from '@/hooks/queries'
import type { DietLens, User } from '@/types'
import { profileFormSchema, type ProfileFormValues } from './profileSchema'

export function ProfileForm({ profile, lenses }: { profile: User; lenses: readonly DietLens[] }) {
  const { showToast } = useToast()
  const update = useUpdateProfile()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.displayName,
      homeCity: profile.homeCity,
      defaultLensIds: profile.defaultLensIds,
    },
  })
  const { errors, isDirty } = form.formState
  const selected = useWatch({ control: form.control, name: 'defaultLensIds' })

  function toggle(lensId: string) {
    const next = selected.includes(lensId)
      ? selected.filter((id) => id !== lensId)
      : [...selected, lensId]
    form.setValue('defaultLensIds', next, { shouldDirty: true })
  }

  async function onSubmit(values: ProfileFormValues) {
    try {
      const saved = await update.mutateAsync(values)
      form.reset({
        displayName: saved.displayName,
        homeCity: saved.homeCity,
        defaultLensIds: saved.defaultLensIds,
      })
      showToast('Profile saved')
    } catch {
      showToast('We couldn’t save your profile. Please try again.', { tone: 'error' })
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-5"
    >
      <Card className="flex flex-col gap-5">
        <h2 className="text-xl">About you</h2>
        <TextField
          label="Display name"
          autoComplete="nickname"
          error={errors.displayName?.message}
          {...form.register('displayName')}
        />
        <TextField
          label="Home city"
          autoComplete="address-level2"
          hint="New restaurants you add are placed in this city."
          error={errors.homeCity?.message}
          {...form.register('homeCity')}
        />
      </Card>

      <Card>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-xl font-semibold">Default diets</legend>
          <p className="text-ink-muted">
            Pre-selected when you log a visit or plan a night out. You can always change them there.
          </p>
          <div className="flex flex-wrap gap-2">
            {lenses.map((lens) => (
              <Chip
                key={lens.id}
                selected={selected.includes(lens.id)}
                icon={<LensIcon icon={lens.icon} />}
                onClick={() => toggle(lens.id)}
              >
                {lens.shortLabel}
              </Chip>
            ))}
          </div>
        </fieldset>
      </Card>

      <div>
        <Button type="submit" size="lg" disabled={update.isPending || !isDirty}>
          {update.isPending ? (
            <>
              <Spinner label="Saving" className="text-on-primary" /> Saving…
            </>
          ) : (
            'Save profile'
          )}
        </Button>
      </div>
    </form>
  )
}
