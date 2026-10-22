import { useState } from 'react'
import { Button, Dialog, ErrorState, SearchField, Skeleton, Spinner } from '@/components'
import { useRepositories } from '@/data/repositoryContext'
import { isRepositoryError } from '@/data'
import { useGifSearch } from '@/hooks/queries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { Gif } from '@/types'

function Results({ query, onPick }: { query: string; onPick: (gif: Gif) => void }) {
  const search = useGifSearch(query)

  if (search.isError) {
    const busy = isRepositoryError(search.error) && search.error.code === 'rate_limited'
    return (
      <ErrorState
        title={busy ? 'GIPHY is busy' : 'We couldn’t load GIFs'}
        message={
          busy
            ? 'Too many searches just now. Try again in a minute.'
            : 'Check your connection and try again.'
        }
        onRetry={() => void search.refetch()}
      />
    )
  }
  if (search.isPending) {
    return (
      <div role="status" aria-busy="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <span className="sr-only">Loading GIFs</span>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    )
  }

  const gifs = search.data.pages.flatMap((page) => page.gifs)
  if (gifs.length === 0) {
    return (
      <p role="status" className="py-8 text-center text-ink-muted">
        No GIFs for “{query.trim()}”. Try another word.
      </p>
    )
  }

  return (
    <>
      <p role="status" className="sr-only">
        {query.trim() ? `${gifs.length} GIFs found` : `${gifs.length} trending GIFs`}
      </p>
      <ul aria-label="GIF results" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {gifs.map((gif) => (
          <li key={gif.id}>
            <button
              type="button"
              onClick={() => onPick(gif)}
              className="block min-h-touch w-full overflow-hidden rounded-md border border-line bg-surface-sunken transition hover:border-primary focus-visible:border-primary"
            >
              <img
                src={gif.previewUrl}
                alt={gif.title}
                loading="lazy"
                width={gif.width}
                height={gif.height}
                className="h-24 w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {search.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="secondary"
            disabled={search.isFetchingNextPage}
            onClick={() => void search.fetchNextPage()}
          >
            {search.isFetchingNextPage ? (
              <>
                <Spinner label="Loading more" /> Loading…
              </>
            ) : (
              'More GIFs'
            )}
          </Button>
        </div>
      )}
    </>
  )
}

/**
 * Search GIPHY (or the demo stand-ins) and pick one. Shows what's trending until the person
 * types. GIPHY's terms ask apps to credit them, so the footer does.
 */
export function GifPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (gif: Gif) => void
}) {
  const { kind } = useRepositories()
  const [text, setText] = useState('')
  const query = useDebouncedValue(text)

  return (
    <Dialog open={open} onClose={onClose} title="Choose a GIF" variant="sheet">
      <div className="flex flex-col gap-3">
        <SearchField
          label="Search GIFs"
          placeholder="Search GIFs, like “chef’s kiss”"
          value={text}
          onChange={setText}
        />
        <Results
          query={query}
          onPick={(gif) => {
            setText('')
            onPick(gif)
          }}
        />
        <p className="text-center text-xs text-ink-muted">
          {kind === 'supabase' ? (
            <>
              Powered by{' '}
              <a
                href="https://giphy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                GIPHY<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          ) : (
            'Demo pictures. Connect Supabase to search GIPHY.'
          )}
        </p>
      </div>
    </Dialog>
  )
}
