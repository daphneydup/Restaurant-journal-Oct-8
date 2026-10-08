import { useEffect, useRef } from 'react'

export type SummaryError = { id: string; message: string }

/**
 * Shown after a failed submit. Moves focus here so screen-reader users hear every problem,
 * and each item jumps to (and focuses) the field it describes.
 */
export function ErrorSummary({ errors, attempt }: { errors: SummaryError[]; attempt: number }) {
  const heading = useRef<HTMLHeadingElement>(null)

  // Re-focus on every failed submit attempt, not just the first.
  useEffect(() => {
    if (errors.length > 0) heading.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on the attempt
  }, [attempt])

  if (errors.length === 0) return null

  function jumpTo(id: string) {
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ block: 'center' })
    const focusable = target.matches('input, select, textarea, button')
      ? target
      : target.querySelector<HTMLElement>('input, button, select, textarea')
    ;(focusable ?? target).focus()
  }

  return (
    <div role="alert" className="rounded-card border-2 border-danger bg-danger-soft p-4">
      <h2 ref={heading} tabIndex={-1} className="text-lg outline-none">
        {errors.length === 1 ? 'One thing to fix' : `${errors.length} things to fix`}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              className="font-medium underline"
              onClick={(event) => {
                event.preventDefault()
                jumpTo(error.id)
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
