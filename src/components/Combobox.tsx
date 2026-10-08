import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ComboboxOption = {
  id: string
  label: string
  description?: string
  icon?: ReactNode
}

/**
 * Accessible autocomplete (WAI-ARIA combobox with a listbox popup). The caller owns the text
 * and the options; this component owns the open/close and keyboard behaviour:
 * Down/Up move, Enter picks, Escape closes, Tab leaves.
 */
export function Combobox({
  label,
  value,
  onValueChange,
  options,
  onSelect,
  placeholder,
  error,
  hint,
  id,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: readonly ComboboxOption[]
  onSelect: (option: ComboboxOption) => void
  placeholder?: string
  error?: string | undefined
  hint?: string
  id?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const listId = `${inputId}-list`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const expanded = open && options.length > 0
  const activeId =
    activeIndex >= 0 && options[activeIndex] ? `${inputId}-opt-${activeIndex}` : undefined
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  function choose(option: ComboboxOption) {
    onSelect(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (options.length === 0 ? -1 : (i + 1) % options.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (options.length === 0 ? -1 : (i <= 0 ? options.length : i) - 1))
    } else if (event.key === 'Enter' && expanded) {
      const option = options[activeIndex]
      // Enter must never submit the surrounding form while the list is open.
      event.preventDefault()
      if (option) choose(option)
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActiveIndex(-1)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'min-h-touch w-full rounded-md border-2 bg-surface px-3 text-base',
          error ? 'border-danger' : 'border-line-strong',
        )}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!expanded}
        className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border-2 border-line-strong bg-surface py-1 shadow-raised"
      >
        {options.map((option, index) => (
          // Keyboard users never focus an option: the input handles Up/Down/Enter via
          // aria-activedescendant (WAI-ARIA combobox pattern), so no key handler belongs here.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={option.id}
            id={`${inputId}-opt-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // Keep focus in the input so the list doesn't close before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(option)}
            className={cn(
              'flex min-h-touch cursor-pointer items-center gap-3 px-3 py-2',
              index === activeIndex ? 'bg-primary-soft' : 'hover:bg-surface-sunken',
            )}
          >
            {option.icon}
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.description && (
                <span className="block text-sm text-ink-muted">{option.description}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
