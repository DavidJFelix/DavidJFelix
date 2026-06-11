import {useEffect, useRef, useState} from 'react'
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PagefindSearchFragment[]>([])
  const [searched, setSearched] = useState(false)
  const [indexMissing, setIndexMissing] = useState(false)
  const [shortcutHint, setShortcutHint] = useState('Ctrl K')
  const [hotkeyReady, setHotkeyReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      setShortcutHint('⌘K')
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((wasOpen) => !wasOpen)
      }
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Declared after the keydown effect: effects run in declaration order, so
  // when the data-hotkey-ready attribute reaches the DOM the Cmd/Ctrl+K
  // listener is already attached. E2E tests wait on it before sending keys —
  // hydration markers alone (astro-island ssr removal) fire before React
  // commits, so keystrokes sent then are dropped.
  useEffect(() => {
    setHotkeyReady(true)
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    } else {
      setQuery('')
      setResults([])
      setSearched(false)
    }
  }, [open])

  useEffect(() => {
    if (query === '') {
      setResults([])
      setSearched(false)
      return
    }
    let stale = false
    void (async () => {
      const pagefind = await loadPagefind()
      if (stale) {
        return
      }
      if (!pagefind) {
        setIndexMissing(true)
        return
      }
      // null means this query was superseded by a newer keystroke
      const search = await pagefind.debouncedSearch(query)
      if (search === null || stale) {
        return
      }
      const data = await Promise.all(
        search.results.slice(0, RESULT_LIMIT).map((result) => result.data()),
      )
      if (!stale) {
        setResults(data)
        setSearched(true)
      }
    })()
    return () => {
      stale = true
    }
  }, [query])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-hotkey-ready={hotkeyReady ? 'true' : undefined}
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
      {open && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is a pointer-only convenience; keyboard users close with Escape
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false)
            }
          }}
          className={css({
            position: 'fixed',
            inset: '0',
            bg: 'rgb(0 0 0 / 0.6)',
            zIndex: '50',
            px: '4',
          })}
        >
          <dialog
            open
            aria-modal="true"
            aria-label="Search posts"
            className={css({
              position: 'static',
              w: 'full',
              maxW: 'xl',
              mx: 'auto',
              mt: '15vh',
              bg: 'zinc.900',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'zinc.700',
              borderRadius: 'lg',
              p: '3',
              boxShadow: 'xl',
            })}
          >
            <input
              ref={inputRef}
              type="search"
              aria-label="Search posts"
              placeholder="Search posts…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
            {indexMissing && (
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
          </dialog>
        </div>
      )}
    </>
  )
}
