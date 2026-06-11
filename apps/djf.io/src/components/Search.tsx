import {useCallback, useEffect, useRef, useState} from 'react'
import {css} from 'styled-system/css'

interface PagefindSearchFragment {
  url: string
  excerpt: string
  meta: {title?: string}
}

interface PagefindSearchResult {
  data: () => Promise<PagefindSearchFragment>
}

interface Pagefind {
  debouncedSearch: (query: string) => Promise<{results: PagefindSearchResult[]} | null>
}

const RESULT_LIMIT = 8

// The Pagefind module and index are emitted by the integration in
// astro.config.mjs during `astro build`, so they exist in built output only —
// never under `astro dev`. Resolved once and cached; null means unavailable.
let pagefindPromise: Promise<Pagefind | null> | undefined

function loadPagefind(): Promise<Pagefind | null> {
  if (pagefindPromise === undefined) {
    const moduleUrl = '/pagefind/pagefind.js'
    pagefindPromise = import(/* @vite-ignore */ moduleUrl).then(
      (pagefind: Pagefind) => pagefind,
      () => null,
    )
  }
  return pagefindPromise
}

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PagefindSearchFragment[]>([])
  const [searched, setSearched] = useState(false)
  const [indexMissing, setIndexMissing] = useState(false)
  const [shortcutHint, setShortcutHint] = useState('Ctrl K')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Monotonic token: bumping it invalidates searches still in flight.
  const searchSeq = useRef(0)

  // Open/close state lives in the native <dialog>, not React: showModal()
  // focuses the input, traps focus, and closes on Escape by itself, and the
  // close event below is the single reset path however the dialog closes.
  const handleClose = useCallback(() => {
    searchSeq.current += 1
    setQuery('')
    setResults([])
    setSearched(false)
  }, [])

  // Searching happens in the change handler rather than an effect; Pagefind's
  // debouncedSearch resolves null for every call superseded by a newer one.
  const runSearch = async (value: string) => {
    setQuery(value)
    const seq = ++searchSeq.current
    if (value === '') {
      setResults([])
      setSearched(false)
      return
    }
    // Previous results stay visible while this search is in flight to avoid
    // flicker, but "No results" must never name a query it didn't check.
    setSearched(false)
    const pagefind = await loadPagefind()
    if (!pagefind) {
      setIndexMissing(true)
      return
    }
    const search = await pagefind.debouncedSearch(value)
    if (search === null || seq !== searchSeq.current) {
      return
    }
    const data = await Promise.all(
      search.results.slice(0, RESULT_LIMIT).map((result) => result.data()),
    )
    if (seq === searchSeq.current) {
      setResults(data)
      setSearched(true)
    }
  }

  // The one real external-system sync: a window-level hotkey listener. The
  // platform hint and the test-readiness marker piggyback on it because both
  // also wait for the same moment — React mounted on the client. The marker
  // is set after addEventListener and read by the e2e tests before they send
  // keystrokes; Astro's own hydration signals fire before listeners attach.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        const dialog = dialogRef.current
        if (dialog?.open) {
          dialog.close()
        } else {
          dialog?.showModal()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    setShortcutHint(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K')
    // Native light dismiss: backdrop clicks close the dialog without any
    // click handler. Set imperatively because React's TS types do not know
    // the attribute yet; browsers without closedby support ignore it and
    // keep Escape (via showModal's cancel behavior) as the dismiss path.
    dialogRef.current?.setAttribute('closedby', 'any')
    buttonRef.current?.setAttribute('data-hotkey-ready', 'true')
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => dialogRef.current?.showModal()}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          color: 'zinc.400',
          bg: 'transparent',
          cursor: 'pointer',
          _hover: {color: 'zinc.100'},
        })}
      >
        Search
        <kbd
          className={css({
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'zinc.700',
            borderRadius: 'sm',
            px: '1.5',
            fontSize: 'xs',
            color: 'zinc.500',
          })}
        >
          {shortcutHint}
        </kbd>
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Search posts"
        onClose={handleClose}
        className={css({
          w: 'full',
          maxW: 'xl',
          mt: '15vh',
          mx: 'auto',
          bg: 'zinc.900',
          color: 'zinc.100',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'zinc.700',
          borderRadius: 'lg',
          p: '0',
          boxShadow: 'xl',
          _backdrop: {bg: 'black/60'},
        })}
      >
        <div className={css({p: '3'})}>
          <input
            type="search"
            aria-label="Search posts"
            placeholder="Search posts…"
            value={query}
            onChange={(event) => void runSearch(event.target.value)}
            className={css({
              width: 'full',
              bg: 'zinc.950',
              color: 'zinc.100',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'zinc.700',
              borderRadius: 'md',
              px: '3',
              py: '2',
              _focus: {outline: 'none', borderColor: 'zinc.500'},
              _placeholder: {color: 'zinc.500'},
            })}
          />
          {indexMissing && query !== '' && (
            <p className={css({color: 'zinc.400', px: '3', py: '4'})}>
              The search index is only generated by production builds — run a build to search
              locally.
            </p>
          )}
          {searched && results.length === 0 && (
            <p className={css({color: 'zinc.400', px: '3', py: '4'})}>No results for “{query}”</p>
          )}
          {results.length > 0 && (
            <ul
              className={css({
                listStyle: 'none',
                mt: '2',
                maxH: '60vh',
                overflowY: 'auto',
              })}
            >
              {results.map((result) => (
                <li key={result.url}>
                  <a
                    href={result.url}
                    className={css({
                      display: 'block',
                      px: '3',
                      py: '2',
                      borderRadius: 'md',
                      textDecoration: 'none',
                      _hover: {bg: 'zinc.800'},
                    })}
                  >
                    <span
                      className={css({
                        display: 'block',
                        color: 'zinc.100',
                        fontWeight: 'semibold',
                      })}
                    >
                      {result.meta.title ?? result.url}
                    </span>
                    <span
                      className={css({
                        display: 'block',
                        color: 'zinc.400',
                        fontSize: 'sm',
                        '& mark': {
                          bg: 'transparent',
                          color: 'blue.400',
                          fontWeight: 'semibold',
                        },
                      })}
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: Pagefind excerpts are built at deploy time from this site's own static content
                      dangerouslySetInnerHTML={{__html: result.excerpt}}
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  )
}
