import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Button, IconButton } from '@/components'

/** Optional first names of who came, as removable chips. Enter adds a name. */
export function CompanionsInput({
  names,
  onChange,
  max = 12,
}: {
  names: string[]
  onChange: (names: string[]) => void
  max?: number
}) {
  const inputId = useId()
  const [draft, setDraft] = useState('')

  function add() {
    const name = draft.trim()
    if (!name || names.some((n) => n.toLowerCase() === name.toLowerCase()) || names.length >= max) {
      setDraft('')
      return
    }
    onChange([...names, name])
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        Who came? (optional)
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={draft}
          maxLength={40}
          autoComplete="off"
          placeholder="First name"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-touch min-w-0 flex-1 rounded-md border-2 border-line-strong bg-surface px-3 text-base"
        />
        <Button variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      {names.length > 0 && (
        <ul aria-label="People who came" className="mt-2 flex flex-wrap gap-2">
          {names.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-control bg-saffron-soft py-0.5 pr-0.5 pl-3 text-sm font-medium text-saffron-strong"
            >
              {name}
              <IconButton
                label={`Remove ${name}`}
                className="size-9"
                onClick={() => onChange(names.filter((n) => n !== name))}
              >
                <X aria-hidden className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
