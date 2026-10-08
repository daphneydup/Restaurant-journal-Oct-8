import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  SegmentedControl,
  Switch,
  TextField,
} from '@/components'

describe('UI primitives', () => {
  it('Button defaults to type=button so it never submits a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('Chip exposes its selected state via aria-pressed', async () => {
    const user = userEvent.setup()
    let selected = false
    const { rerender } = render(
      <Chip selected={selected} onClick={() => (selected = !selected)}>
        Vegan
      </Chip>,
    )
    const chip = screen.getByRole('button', { name: 'Vegan' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await user.click(chip)
    rerender(<Chip selected={selected}>Vegan</Chip>)
    expect(screen.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('TextField links its label, hint and error to the input', () => {
    render(<TextField label="Name" hint="As on the menu" error="Name is required" />)
    const input = screen.getByLabelText('Name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('As on the menu Name is required')
  })

  it('SegmentedControl is a labelled radio group that reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        legend="Worked for everyone?"
        value="maybe"
        onChange={onChange}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'maybe', label: 'Maybe' },
          { value: 'no', label: 'No' },
        ]}
      />,
    )
    expect(screen.getByRole('group', { name: 'Worked for everyone?' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Yes' }))
    expect(onChange).toHaveBeenCalledWith('yes')
  })

  it('Switch is a labelled switch', () => {
    render(<Switch label="Go back" defaultChecked />)
    expect(screen.getByRole('switch', { name: 'Go back' })).toBeChecked()
  })

  it('EmptyState renders title, description and action', () => {
    render(
      <EmptyState
        title="Nothing yet"
        description="Log your first visit"
        action={<Button>Log</Button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeInTheDocument()
    expect(screen.getByText('Log your first visit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log' })).toBeInTheDocument()
  })

  it('ErrorState announces itself and offers retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
