import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repositories } from '@/data'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories, TEST_NOW } from '@/test/testRepositories'

let repos: Repositories

beforeEach(() => {
  // Only Date is faked, so "today" is stable while timers and promises behave normally.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
  repos = createTestRepositories()
})

afterEach(() => {
  vi.useRealTimers()
})

async function openForm(path = '/log') {
  const user = userEvent.setup()
  await renderApp(path, { repositories: repos })
  await screen.findByRole('heading', { name: 'Where & when' })
  return user
}

/** Types in the restaurant search box and picks the option with the given name. */
async function pickRestaurant(
  user: ReturnType<typeof userEvent.setup>,
  search: string,
  option: string | RegExp,
) {
  await user.type(screen.getByRole('combobox', { name: 'Restaurant' }), search)
  await user.click(await screen.findByRole('option', { name: option }))
}

async function rate(user: ReturnType<typeof userEvent.setup>, lens: string, stars: number) {
  const group = screen.getByRole('group', { name: `Rating for ${lens}` })
  await user.click(within(group).getByRole('radio', { name: new RegExp(`^${stars} of 5`) }))
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Save visit' }))

describe('Log a Visit page: loading the form', () => {
  it('shows a loading state, then the form with the profile’s diets preselected and today’s date', async () => {
    await renderApp('/log', { repositories: createTestRepositories({ latencyMs: 500 }) })
    expect(screen.getByText('Loading the form')).toBeInTheDocument()

    await screen.findByRole('heading', { name: 'Where & when' })
    expect(screen.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Steak' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gluten-free' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-08')
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers every diet lens from the data as a chip', async () => {
    await openForm()
    const lenses = await repos.lenses.list()
    for (const lens of lenses) {
      expect(screen.getByRole('button', { name: lens.shortLabel })).toBeInTheDocument()
    }
  })

  it('shows an error state with retry when the data fails to load', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = userEvent.setup()
    await renderApp('/log', { repositories: repos })

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load the form')

    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Where & when' })).toBeInTheDocument()
  })

  it('preselects the restaurant from ?restaurantId= along with its usual price', async () => {
    await openForm('/log?restaurantId=r-copper')
    expect(screen.getByText('The Copper Table')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Restaurant' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /^More details/ }))
    expect(screen.getByRole('radio', { name: /^\$\$\$\$ \(splurge\)/ })).toBeChecked()
  })

  it('ignores an unknown ?restaurantId=', async () => {
    await openForm('/log?restaurantId=ghost')
    expect(screen.getByRole('combobox', { name: 'Restaurant' })).toBeInTheDocument()
  })
})

describe('Log a Visit page: the 30-second path', () => {
  it('logs a visit with a spot, one tap per diet, and Save', async () => {
    const user = await openForm()
    const before = await repos.visits.listByRestaurant('r-noodle')

    await pickRestaurant(user, 'noodle', /Noodle & Nori/)
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 4)
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked() // suggested, no extra tap
    await save(user)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Visit saved at Noodle & Nori. You earned 50 points.'),
    ).toBeInTheDocument()

    const after = await repos.visits.listByRestaurant('r-noodle')
    expect(after).toHaveLength(before.length + 1)
    expect(after[0]).toMatchObject({
      date: '2026-10-08',
      workedForEveryone: 'yes',
      priceTier: 1, // inherited from the restaurant
      ratings: [
        { lensId: 'vegan', rating: 5 },
        { lensId: 'steak', rating: 4 },
      ],
    })
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Visit history (2)' }),
    ).toBeInTheDocument()
  })

  it('can be driven entirely from the keyboard in the search box', async () => {
    const user = await openForm()
    const box = screen.getByRole('combobox', { name: 'Restaurant' })
    await user.type(box, 'little fig')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByText('Little Fig Kitchen')).toBeInTheDocument()
    // Enter chose the option; it must not have submitted the form.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Log a Visit page: adding a new restaurant', () => {
  it('creates the restaurant, the visit and a go-back entry together', async () => {
    const user = await openForm()

    await user.type(screen.getByRole('combobox', { name: 'Restaurant' }), 'Paper Lantern')
    await user.click(
      await screen.findByRole('option', { name: /Add “Paper Lantern” as a new spot/ }),
    )

    expect(screen.getByRole('textbox', { name: 'Restaurant name' })).toHaveValue('Paper Lantern')
    await user.click(screen.getByRole('button', { name: 'Oak Cliff' }))
    expect(screen.getByRole('textbox', { name: 'Neighborhood' })).toHaveValue('Oak Cliff')
    await user.click(screen.getByRole('radio', { name: /^\$\$\$ \(upscale\)/ }))

    await rate(user, 'Vegan options', 4)
    await rate(user, 'Steak / meat', 4)
    await user.click(screen.getByRole('button', { name: /^More details/ }))
    await user.click(screen.getByRole('switch', { name: /Add to my Go-Back list/ }))
    await save(user)

    await screen.findByRole('heading', { level: 1, name: 'Paper Lantern' })
    const created = (await repos.restaurants.list()).find((r) => r.name === 'Paper Lantern')
    expect(created).toMatchObject({ neighborhood: 'Oak Cliff', city: 'Dallas', priceTier: 3 })
    expect(await repos.visits.listByRestaurant(created!.id)).toHaveLength(1)
    expect(await repos.goBack.getByRestaurantId(created!.id)).not.toBeNull()
  })

  it('requires a name and neighborhood for a new spot', async () => {
    const user = await openForm()
    await user.type(screen.getByRole('combobox', { name: 'Restaurant' }), 'Paper Lantern')
    await user.click(await screen.findByRole('option', { name: /Add “Paper Lantern”/ }))
    await save(user)

    const summary = await screen.findByRole('alert')
    expect(
      within(summary).getByRole('link', { name: 'Enter the neighborhood' }),
    ).toBeInTheDocument()
    expect(await repos.restaurants.list()).not.toContainEqual(
      expect.objectContaining({ name: 'Paper Lantern' }),
    )
  })

  it('explains when the new spot already exists, and saves nothing', async () => {
    const user = await openForm()
    await user.type(screen.getByRole('combobox', { name: 'Restaurant' }), 'Noodle & Nori')
    await user.click(await screen.findByRole('option', { name: /Add “Noodle & Nori”/ }))
    await user.click(screen.getByRole('button', { name: 'Deep Ellum' }))
    await rate(user, 'Vegan options', 4)
    await rate(user, 'Steak / meat', 4)
    const visitsBefore = (await repos.visits.list()).length
    await save(user)

    expect(await screen.findByText(/already in your spots/i)).toBeInTheDocument()
    expect(screen.getAllByText(/already saved/i).length).toBeGreaterThan(0)
    expect(await repos.visits.list()).toHaveLength(visitsBefore)

    // Recover: go back to searching and pick the existing spot.
    await user.click(screen.getByRole('button', { name: 'Search saved spots instead' }))
    await user.click(await screen.findByRole('option', { name: /^Noodle & Nori/ }))
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' })
  })
})

describe('Log a Visit page: validation', () => {
  it('lists everything that needs fixing, focuses the list, and saves nothing', async () => {
    const user = await openForm()
    const visitsBefore = (await repos.visits.list()).length
    await save(user)

    const summary = await screen.findByRole('alert')
    expect(within(summary).getByRole('heading', { name: '4 things to fix' })).toHaveFocus()
    expect(
      within(summary).getByRole('link', { name: 'Choose a spot, or add a new one' }),
    ).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Vegan: tap a rating' })).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Steak: tap a rating' })).toBeInTheDocument()
    expect(
      within(summary).getByRole('link', { name: 'Choose yes, maybe or no' }),
    ).toBeInTheDocument()
    expect(await repos.visits.list()).toHaveLength(visitsBefore)
  })

  it('shows the message next to each field too', async () => {
    const user = await openForm()
    await save(user)
    const vegan = screen.getByRole('group', { name: 'Rating for Vegan options' })
    expect(within(vegan).getByText('Tap a rating')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Restaurant' })).toBeInvalid()
  })

  it('clears each problem as soon as it is fixed', async () => {
    const user = await openForm()
    await save(user)
    await pickRestaurant(user, 'noodle', /Noodle & Nori/)
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 5)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' })
  })

  it('jumps to the field when an error is clicked', async () => {
    const user = await openForm()
    await save(user)
    await user.click(screen.getByRole('link', { name: 'Steak: tap a rating' }))
    const steak = screen.getByRole('group', { name: 'Rating for Steak / meat' })
    expect(within(steak).getAllByRole('radio')[0]).toHaveFocus()
  })

  it('rejects a future date', async () => {
    const user = await openForm()
    await pickRestaurant(user, 'noodle', /Noodle & Nori/)
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 5)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-09' } })
    await save(user)

    expect(
      await screen.findByRole('link', { name: 'Visits can’t be in the future' }),
    ).toBeInTheDocument()
  })

  it('needs at least one diet at the table', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: 'Vegan' }))
    await user.click(screen.getByRole('button', { name: 'Steak' }))
    await save(user)
    expect(await screen.findByRole('link', { name: 'Pick at least one diet' })).toBeInTheDocument()
  })
})

describe('Log a Visit page: diets and the "worked for everyone" suggestion', () => {
  it('adds and removes rating rows as diets are toggled', async () => {
    const user = await openForm()
    expect(screen.queryByRole('group', { name: 'Rating for Gluten-free' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Gluten-free' }))
    expect(screen.getByRole('group', { name: 'Rating for Gluten-free' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Steak' }))
    expect(screen.queryByRole('group', { name: 'Rating for Steak / meat' })).not.toBeInTheDocument()
  })

  it('suggests no / maybe / yes from the ratings', async () => {
    const user = await openForm()
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 2)
    expect(screen.getByRole('radio', { name: 'No' })).toBeChecked()
    expect(screen.getByText(/Suggested from your ratings/)).toBeInTheDocument()

    await rate(user, 'Steak / meat', 3)
    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked()

    await rate(user, 'Steak / meat', 5)
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked()
  })

  it('stops suggesting once the user answers themselves', async () => {
    const user = await openForm()
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 5)
    await user.click(screen.getByRole('radio', { name: 'Maybe' }))
    expect(screen.queryByText(/Suggested from your ratings/)).not.toBeInTheDocument()

    await rate(user, 'Steak / meat', 1)
    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked()
  })
})

describe('Log a Visit page: optional details', () => {
  it('keeps optional fields collapsed until asked', async () => {
    const user = await openForm()
    expect(screen.queryByRole('textbox', { name: /Note/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^More details/ }))
    expect(screen.getByRole('textbox', { name: /Note/ })).toBeInTheDocument()
  })

  it('saves dishes, a note, companions and worth-it with the visit', async () => {
    const user = await openForm()
    await pickRestaurant(user, 'noodle', /Noodle & Nori/)
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 4)
    await user.click(screen.getByRole('button', { name: /^More details/ }))

    await user.type(screen.getByRole('textbox', { name: 'Dishes to remember' }), 'Gyoza')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    const dishBox = screen.getByRole('textbox', { name: 'Dishes to remember' })
    await user.type(dishBox, 'Miso ramen')
    await user.click(
      within(screen.getByRole('group', { name: 'This dish works for' })).getByRole('button', {
        name: 'Vegan',
      }),
    )
    await user.click(dishBox)
    await user.keyboard('{Enter}') // Enter = "Order again"
    expect(screen.getByRole('list', { name: 'Dishes you added' }).children).toHaveLength(2)

    await user.click(screen.getByRole('radio', { name: 'Worth it' }))
    await user.type(screen.getByRole('textbox', { name: /Note/ }), 'Loud but great')
    await user.type(screen.getByRole('textbox', { name: /Who came/ }), 'Maya{Enter}')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' })

    const [visit] = await repos.visits.listByRestaurant('r-noodle')
    expect(visit).toMatchObject({ worthIt: true, note: 'Loud but great', companions: ['Maya'] })
    const dishes = (await repos.dishes.listByRestaurant('r-noodle')).filter(
      (d) => d.visitId === visit!.id,
    )
    expect(dishes.map((d) => [d.name, d.verdict, d.lensIds])).toEqual(
      expect.arrayContaining([
        ['Gyoza', 'skip', []],
        ['Miso ramen', 'order-again', ['vegan']],
      ]),
    )
  })

  it('removes a dish from the list', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: /^More details/ }))
    await user.type(screen.getByRole('textbox', { name: 'Dishes to remember' }), 'Gyoza{Enter}')
    await user.click(screen.getByRole('button', { name: 'Remove Gyoza' }))
    expect(screen.queryByRole('list', { name: 'Dishes you added' })).not.toBeInTheDocument()
  })

  it('asks for a dish name instead of adding an empty dish', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: /^More details/ }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Type a dish name first.')).toBeInTheDocument()
  })

  it('shows a live character count on the note', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: /^More details/ }))
    await user.type(screen.getByRole('textbox', { name: /Note/ }), 'Yum')
    expect(screen.getByText('3/280')).toBeInTheDocument()
  })

  it('lets a companion be removed again', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('button', { name: /^More details/ }))
    await user.type(screen.getByRole('textbox', { name: /Who came/ }), 'Maya{Enter}')
    await user.click(screen.getByRole('button', { name: 'Remove Maya' }))
    expect(screen.queryByRole('list', { name: 'People who came' })).not.toBeInTheDocument()
  })
})

describe('Log a Visit page: saving', () => {
  it('disables Save while saving, so a double tap cannot log twice', async () => {
    const slow = createTestRepositories({ latencyMs: 20 })
    repos = slow
    vi.useRealTimers() // real timers for the artificial latency
    const user = userEvent.setup()
    await renderApp('/log', { repositories: slow })
    await screen.findByRole('heading', { name: 'Where & when' })

    await pickRestaurant(user, 'noodle', /Noodle & Nori/)
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 5)
    const before = (await slow.visits.listByRestaurant('r-noodle')).length
    const button = screen.getByRole('button', { name: 'Save visit' })
    await user.dblClick(button)

    await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' })
    expect(await slow.visits.listByRestaurant('r-noodle')).toHaveLength(before + 1)
  })

  it('shows a retryable error when saving fails, keeping what was entered', async () => {
    const user = await openForm()
    await pickRestaurant(user, 'noodle', /Noodle & Nori/)
    await rate(user, 'Vegan options', 5)
    await rate(user, 'Steak / meat', 5)

    repos.dev?.setSimulateErrors(true)
    await save(user)
    expect(await screen.findByText(/couldn’t save your visit/i)).toBeInTheDocument()
    expect(screen.getByText('Noodle & Nori')).toBeInTheDocument() // form kept its state

    repos.dev?.setSimulateErrors(false)
    await save(user)
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Noodle & Nori' })).toBeInTheDocument(),
    )
  })
})
