import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryError } from '@/data'
import { buildDemoSeed } from '@/data/mock/seed/demo'
import { forgetReferral, pendingReferral, rememberReferral } from '@/lib/pendingReferral'
import { REWARD_CATALOG } from '@/lib/rewardsCatalog'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories, TEST_NOW } from '@/test/testRepositories'

/** A person with exactly `points` points, no vouchers, and a given invite history. */
function reposWith(points: number, { invites = 0 }: { invites?: number } = {}) {
  return createTestRepositories({
    seed: (at) => ({
      ...buildDemoSeed(at),
      rewards: {
        ledger: [
          {
            id: 'gift',
            kind: 'invite',
            points,
            label: 'A gift',
            restaurantId: null,
            createdAt: at.toISOString(),
          },
          ...Array.from({ length: invites }, (_, i) => ({
            id: `inv-${i}`,
            kind: 'invite' as const,
            points: 200,
            label: 'A friend joined with your invite',
            restaurantId: null,
            createdAt: at.toISOString(),
          })),
        ],
        vouchers: [],
        referralCode: null,
        claimedCode: null,
      },
    }),
  })
}

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
  user = userEvent.setup()
  localStorage.clear()
  forgetReferral()
})
afterEach(() => vi.useRealTimers())

describe('Rewards page', () => {
  it('shows the balance, how far the next perk is, and lifetime points', async () => {
    await renderApp('/rewards', { repositories: reposWith(130) })
    const hero = await screen.findByRole('region', { name: 'Your points' })
    expect(hero).toHaveTextContent('130')
    expect(hero).toHaveTextContent('20 more points unlock your next perk') // cheapest perk is 150
    expect(hero).toHaveTextContent('130 points earned in total')
  })

  it('lists every perk, and only offers Redeem on the ones the person can afford', async () => {
    await renderApp('/rewards', { repositories: reposWith(130) })
    await screen.findByRole('heading', { name: 'Perks' })
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(REWARD_CATALOG.length)

    const drink = screen.getByRole('button', {
      name: /^Redeem Signature cocktail or mocktail for 120/,
    })
    expect(drink).toBeEnabled()
    const appetizer = screen.getByRole('button', {
      name: /^Redeem Complimentary appetizer, 20 more points needed/,
    })
    expect(appetizer).toBeDisabled()
    expect(
      screen
        .getAllByRole('button', { name: /^Redeem / })
        .filter((b) => !(b as HTMLButtonElement).disabled),
    ).toHaveLength(1)
  })

  it('says the perks are samples, so nobody expects a real free dinner', async () => {
    await renderApp('/rewards', { repositories: reposWith(0) })
    expect(await screen.findByText(/partners are fictional/i)).toBeInTheDocument()
  })

  it('redeems after a confirmation: points drop, the voucher appears with its code', async () => {
    const repos = reposWith(500)
    await renderApp('/rewards', { repositories: repos })
    await user.click(
      await screen.findByRole('button', { name: /^Redeem Signature cocktail or mocktail/ }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'This spends 120 points at Marigold Social. You will have 380 left.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Redeem' }))

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Your points' })).toHaveTextContent('380'),
    )
    const [voucher] = await repos.rewards.listVouchers()
    expect(voucher).toBeDefined()
    expect(screen.getByText(voucher!.code)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Signature cocktail or mocktail is yours')
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const repos = reposWith(500)
    await renderApp('/rewards', { repositories: repos })
    await user.click(
      await screen.findByRole('button', { name: /^Redeem Signature cocktail or mocktail/ }),
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    )
    expect((await repos.rewards.getSummary()).balance).toBe(500)
    expect(await repos.rewards.listVouchers()).toEqual([])
  })

  it('reports a refusal from the data layer instead of pretending it worked', async () => {
    const repos = reposWith(500)
    repos.rewards.redeem = () =>
      Promise.reject(new RepositoryError('insufficient_points', 'Not enough'))
    await renderApp('/rewards', { repositories: repos })
    await user.click(
      await screen.findByRole('button', { name: /^Redeem Signature cocktail or mocktail/ }),
    )
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Redeem' }),
    )
    expect(await screen.findByText(/couldn’t redeem that|enough points/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your points' })).toHaveTextContent('500')
  })

  it('shows live vouchers first, marks one as used, and dims past ones', async () => {
    const repos = createTestRepositories() // the demo person has one live and one used voucher
    await renderApp('/rewards', { repositories: repos })
    const live = await screen.findByRole('button', {
      name: /^Mark Signature cocktail or mocktail as used/,
    })
    expect(screen.getByText('Used')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Mark Dessert to share as used/ }),
    ).not.toBeInTheDocument()

    await user.click(live)
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /^Mark Signature cocktail or mocktail as used/ }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getAllByText('Used')).toHaveLength(2)
  })

  it('shows an expired voucher as expired, with no way to use it', async () => {
    const repos = createTestRepositories({
      seed: (at) => {
        const seed = buildDemoSeed(at)
        const [live, used] = seed.rewards.vouchers
        return {
          ...seed,
          rewards: {
            ...seed.rewards,
            vouchers: [{ ...live!, expiresAt: '2026-10-01T00:00:00.000Z' }, used!],
          },
        }
      },
    })
    await renderApp('/rewards', { repositories: repos })
    expect(await screen.findByText('Expired')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Mark .* as used/ })).not.toBeInTheDocument()
  })

  it('has an empty state for vouchers and for history', async () => {
    await renderApp('/rewards', {
      repositories: createTestRepositories({
        seed: (at) => ({
          ...buildDemoSeed(at),
          rewards: { ledger: [], vouchers: [], referralCode: null, claimedCode: null },
        }),
      }),
    })
    expect(await screen.findByText('No vouchers yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Points history/ }))
    expect(screen.getByText(/No points yet/)).toBeInTheDocument()
  })

  it('lists the history with earned and spent points announced to screen readers', async () => {
    await renderApp('/rewards', { repositories: createTestRepositories() })
    await user.click(await screen.findByRole('button', { name: /^Points history/ }))
    const history = screen.getByRole('list', { name: 'Points history' })
    expect(within(history).getAllByText(/points earned/).length).toBeGreaterThan(0)
    expect(within(history).getAllByText(/points spent/).length).toBe(2)
  })

  it('explains the earning rules using the real numbers', async () => {
    await renderApp('/rewards', { repositories: reposWith(0) })
    expect(
      await screen.findByText(
        /50 points for every visit you log, plus 10 for a note and 10 for a photo/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/Up to 3 visits a day earn points/)).toBeInTheDocument()
  })
})

describe('earning on other screens', () => {
  it('shows the balance on My Spots, linking to Rewards', async () => {
    await renderApp('/', { repositories: reposWith(1234) })
    await screen.findByRole('heading', { name: 'Ember & Orchard' })
    const pill = await screen.findByRole('link', { name: /1,234 points/ })
    expect(pill).toHaveAttribute('href', '/rewards')
  })

  it('links to Rewards and Invite from Profile, where phones have no tab for them', async () => {
    await renderApp('/profile', { repositories: reposWith(75) })
    const rewards = await screen.findByRole('link', { name: /^Rewards.*75 points/ })
    expect(rewards).toHaveAttribute('href', '/rewards')
    expect(screen.getByRole('link', { name: /^Invite friends/ })).toHaveAttribute('href', '/invite')
  })

  it('puts Rewards in the side navigation but not the five-tab mobile bar', async () => {
    await renderApp('/')
    const side = screen.getByRole('navigation', { name: 'Primary' })
    const tabs = screen.getByRole('navigation', { name: 'Primary, mobile' })
    expect(within(side).getByRole('link', { name: 'Rewards' })).toHaveAttribute('href', '/rewards')
    expect(within(tabs).queryByRole('link', { name: 'Rewards' })).not.toBeInTheDocument()
  })

  it('tells the person what a logged visit earned', async () => {
    const repos = reposWith(0)
    await renderApp('/log?restaurantId=r-noodle', { repositories: repos })
    await screen.findByRole('heading', { name: 'Where & when' })
    const group = screen.getByRole('group', { name: 'Rating for Vegan options' })
    await user.click(within(group).getByRole('radio', { name: /^5 of 5/ }))
    const steak = screen.getByRole('group', { name: 'Rating for Steak / meat' })
    await user.click(within(steak).getByRole('radio', { name: /^3 of 5/ }))
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(await screen.findByText(/You earned 50 points/)).toBeInTheDocument()
    expect((await repos.rewards.getSummary()).balance).toBe(50)
  })
})

describe('Invite page', () => {
  it('shows the person’s own code and link, and how their invites paid off', async () => {
    const repos = reposWith(0, { invites: 2 })
    await renderApp('/invite', { repositories: repos })
    const { code } = await repos.rewards.getReferral()
    expect(await screen.findByText(code)).toBeInTheDocument()
    const link = screen.getByLabelText('Your invite link') as HTMLInputElement
    expect(link.value).toBe(`${window.location.origin}/join?ref=${code}`)
    expect(screen.getByLabelText('Your invites')).toHaveTextContent(
      'friends have joined with your invite',
    )
    expect(screen.getByLabelText('Your invites')).toHaveTextContent('400 points')
  })

  it('tells a guest that invites are for members', async () => {
    await renderApp('/invite', { repositories: reposWith(0) })
    expect(await screen.findByText(/Invites are for members/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.queryByRole('button', { name: 'Apply code' })).not.toBeInTheDocument()
  })

  it('lets a member apply a friend’s code once, and then says it was used', async () => {
    const repos = reposWith(0)
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    await renderApp('/invite', { repositories: repos })

    await user.type(await screen.findByLabelText('A friend’s invite code'), 'tfe-abc234')
    await user.click(screen.getByRole('button', { name: 'Apply code' }))
    expect(await screen.findByText(/already used a friend’s invite/)).toBeInTheDocument()
    expect((await repos.rewards.getSummary()).balance).toBe(200)
  })

  it('rejects a code that is not shaped like an invite, without calling the data layer', async () => {
    const repos = reposWith(0)
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    const claim = vi.spyOn(repos.rewards, 'claimReferral')
    await renderApp('/invite', { repositories: repos })
    await user.type(await screen.findByLabelText('A friend’s invite code'), 'hello')
    await user.click(screen.getByRole('button', { name: 'Apply code' }))
    expect(await screen.findByText('Enter a code like TFE-ABC234')).toBeInTheDocument()
    expect(claim).not.toHaveBeenCalled()
  })

  it('shows the message when the code is your own', async () => {
    const repos = reposWith(0)
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    const { code } = await repos.rewards.getReferral()
    await renderApp('/invite', { repositories: repos })
    await user.type(await screen.findByLabelText('A friend’s invite code'), code)
    await user.click(screen.getByRole('button', { name: 'Apply code' }))
    expect(await screen.findByText('You can’t use your own invite code.')).toBeInTheDocument()
  })
})

describe('Join page and the invite claimer', () => {
  it('remembers a valid code and invites a guest to create an account', async () => {
    await renderApp('/join?ref=tfe-abc234', { repositories: reposWith(0) })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A friend saved you a seat' }),
    ).toBeInTheDocument()
    expect(pendingReferral()).toBe('TFE-ABC234')
    expect(screen.getByRole('link', { name: 'Create my account' })).toHaveAttribute(
      'href',
      '/signup',
    )
  })

  it('ignores a missing or malformed code and remembers nothing', async () => {
    await renderApp('/join?ref=nonsense', { repositories: reposWith(0) })
    expect(await screen.findByText('That invite link looks incomplete')).toBeInTheDocument()
    expect(pendingReferral()).toBeNull()
  })

  it('pays the welcome bonus automatically once the person is a member, then forgets the code', async () => {
    const repos = reposWith(0)
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    await renderApp('/join?ref=TFE-ABC234', { repositories: repos })

    expect(await screen.findByText(/Welcome bonus: 200 points added/)).toBeInTheDocument()
    expect((await repos.rewards.getSummary()).balance).toBe(200)
    expect(pendingReferral()).toBeNull()
  })

  it('claims a remembered code when a guest later signs up, without asking again', async () => {
    const repos = reposWith(0)
    rememberReferral('TFE-ABC234')
    await renderApp('/', { repositories: repos })
    await screen.findByRole('heading', { level: 1, name: 'My Spots' })
    expect(pendingReferral()).toBe('TFE-ABC234') // still a guest: kept, nothing claimed
    expect((await repos.rewards.getSummary()).balance).toBe(0)

    await act(async () => {
      await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    })
    await waitFor(() => expect(pendingReferral()).toBeNull())
    expect((await repos.rewards.getSummary()).balance).toBe(200)
  })

  it('keeps the code when the server can’t be reached, and drops it for a definite answer', async () => {
    const repos = reposWith(0)
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    const original = repos.rewards.claimReferral.bind(repos.rewards)
    repos.rewards.claimReferral = () =>
      Promise.reject(new RepositoryError('unavailable', 'offline'))
    rememberReferral('TFE-ABC234')
    await renderApp('/', { repositories: repos })
    await screen.findByRole('heading', { level: 1, name: 'My Spots' })
    await act(async () => {})
    expect(pendingReferral()).toBe('TFE-ABC234')

    repos.rewards.claimReferral = original
    rememberReferral('TFE-ABC234') // a fresh visit
    await renderApp('/', { repositories: repos })
    await waitFor(() => expect(pendingReferral()).toBeNull())
  })

  it('claims at most once per code even when the screen re-renders', async () => {
    const repos = reposWith(0)
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    const spy = vi.spyOn(repos.rewards, 'claimReferral')
    rememberReferral('TFE-ABC234')
    await renderApp('/', { repositories: repos })
    await waitFor(() => expect(pendingReferral()).toBeNull())
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
