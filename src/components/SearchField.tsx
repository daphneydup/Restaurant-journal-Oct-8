import { Search, X } from 'lucide-react'
import { useId } from 'react'

/** Search box with a visually hidden label (the magnifier and placeholder say the rest). */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
      />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className="min-h-touch w-full rounded-pill border-2 border-line-strong bg-surface pr-12 pl-10 text-base [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 flex size-touch -translate-y-1/2 items-center justify-center rounded-pill hover:bg-surface-sunken"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
