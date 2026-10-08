import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Combobox,
  Disclosure,
  PriceTierPicker,
  RatingInput,
  ToastProvider,
  useToast,
} from '@/components'
import type { PriceTier, RatingValue } from '@/types'

describe('RatingInput', () => {
  function Harness({ initial }: { initial?: RatingValue }) {
    const [value, setValue] = useState<RatingValue | undefined>(initial)
    return <RatingInput legend="Rating for Vegan" value={value} onChange={setValue} />
  }

  it('is a labelled group of five radios with descriptive names', () => {
    render(<Harness />)
    const group = screen.getByRole('group', { name: 'Rating for Vegan' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      '1 of 5, Poor',
      '2 of 5, Meh',
      '3 of 5, Okay',
      '4 of 5, Good',
      '5 of 5, Great',
    ])
    expect(screen.getByText('Tap to rate')).toBeInTheDocument()
  })

  it('selects on click and writes the choice out in words (not colour alone)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: '4 of 5, Good' }))
    expect(screen.getByRole('radio', { name: '4 of 5, Good' })).toBeChecked()
    expect(screen.getByText('Good · 4/5')).toBeInTheDocument()
  })

  it('moves with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness initial={3} />)
    screen.getByRole('radio', { name: '3 of 5, Okay' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '4 of 5, Good' })).toBeChecked()
  })

  it('links an error message to the group', () => {
    render(
      <RatingInput
        legend="Rating for Vegan"
        value={undefined}
        onChange={() => {}}
        error="Tap a rating"
      />,
    )
    expect(screen.getByRole('group', { name: 'Rating for Vegan' })).toHaveAccessibleDescription(
      'Tap a rating',
    )
  })
})

describe('PriceTierPicker', () => {
  it('shows $ symbols but is announced with a word for each tier', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn<(tier: PriceTier) => void>()
    render(<PriceTierPicker value={2} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: '$$ (moderate)' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: '$$$$ (splurge)' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })
})

describe('Combobox', () => {
  const options = [
    { id: 'a', label: 'Alpha', description: 'First' },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma' },
  ]

  function Harness({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
    const [value, setValue] = useState('')
    return (
      <form onSubmit={(e) => e.preventDefault()}>
        <Combobox
          label="Letter"
          value={value}
          onValueChange={setValue}
          options={options}
          onSelect={(o) => onSelect(o.id)}
        />
        <button type="submit">Submit</button>
      </form>
    )
  }

  it('opens on focus and exposes combobox/listbox/option semantics', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Letter' })
    expect(box).toHaveAttribute('aria-expanded', 'false')
    await user.click(box)
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('tracks the active option with aria-activedescendant and wraps around', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Letter' })
    await user.click(box)
    await user.keyboard('{ArrowDown}')
    expect(box).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Alpha/ }).id,
    )
    await user.keyboard('{ArrowUp}')
    expect(box).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Gamma/ }).id,
    )
    expect(screen.getByRole('option', { name: /Gamma/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('Enter picks the active option and does not submit the form', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSubmit = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Combobox
          label="Letter"
          value=""
          onValueChange={() => {}}
          options={options}
          onSelect={(o) => onSelect(o.id)}
        />
      </form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Letter' }))
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Escape closes the list', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const box = screen.getByRole('combobox', { name: 'Letter' })
    await user.click(box)
    await user.keyboard('{Escape}')
    expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  it('picks with the mouse without losing focus first', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    await user.click(screen.getByRole('combobox', { name: 'Letter' }))
    await user.click(screen.getByRole('option', { name: /Gamma/ }))
    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('does not claim to be expanded when there is nothing to show', async () => {
    const user = userEvent.setup()
    render(
      <Combobox
        label="Letter"
        value=""
        onValueChange={() => {}}
        options={[]}
        onSelect={() => {}}
      />,
    )
    await user.click(screen.getByRole('combobox', { name: 'Letter' }))
    expect(screen.getByRole('combobox', { name: 'Letter' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

describe('Disclosure', () => {
  it('toggles with aria-expanded and keeps content mounted while hidden', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <Disclosure label="More" open={open} onOpenChange={setOpen}>
          <input aria-label="Inside" defaultValue="kept" />
        </Disclosure>
      )
    }
    render(<Harness />)
    const toggle = screen.getByRole('button', { name: 'More' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const input = screen.getByLabelText('Inside') // still mounted, so it keeps its value
    expect(input).not.toBeVisible()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(input).toBeVisible()
    expect(input).toHaveValue('kept')
  })
})

describe('Toasts', () => {
  afterEach(() => vi.useRealTimers())

  function Trigger() {
    const { showToast } = useToast()
    return (
      <>
        <button onClick={() => showToast('Saved!')}>Success</button>
        <button onClick={() => showToast('Oh no', { tone: 'error' })}>Fail</button>
      </>
    )
  }

  it('announces messages politely and lets the user dismiss them', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Success' }))
    const live = screen.getByText('Saved!').closest('[aria-live]')
    expect(live).toHaveAttribute('aria-live', 'polite')

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })

  it('disappears on its own after a few seconds', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'Fail' }).click())
    expect(screen.getByText('Oh no')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(6100)
    })
    expect(screen.queryByText('Oh no')).not.toBeInTheDocument()
  })

  it('refuses to be used outside its provider', () => {
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)
  })
})
