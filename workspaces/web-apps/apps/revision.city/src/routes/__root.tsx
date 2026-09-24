import {ogSite, ogTags} from '@davidjfelix/og'
import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, ScriptOnce, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'

import {css} from 'styled-system/css'

import {themeBootstrapScript} from '@/diffs/lib/theme-bootstrap'
import {site} from '@/site'
import appCss from '../styles.css?url'

// The search params that make a path another page: the viewer's `domain`
// points the same path at another host, so it belongs in og:url and the
// canonical link. Listed here rather than read off the match, because the
// router hands every match the raw search merged with what its route
// validates, so a tracker's tag on the link would ride along otherwise.
const SHARED_SEARCH_KEYS: ReadonlySet<string> = new Set(['domain'])

function getSharePath(leaf: {pathname: string; search: object} | undefined): string {
  if (leaf === undefined) {
    return '/'
  }
  const search = new URLSearchParams(
    Object.entries(leaf.search).filter(
      (entry): entry is [string, string] =>
        SHARED_SEARCH_KEYS.has(entry[0]) && typeof entry[1] === 'string' && entry[1] !== '',
    ),
  ).toString()
  return search === '' ? leaf.pathname : `${leaf.pathname}?${search}`
}

export const Route = createRootRoute({
  // The leaf match carries the requested path, so og:url and the canonical
  // link name the page being shared rather than the site root.
  head: ({matches}) => {
    const social = ogSite({...site, path: getSharePath(matches.at(-1))})
    return {
      meta: [
        {charSet: 'utf-8'},
        {name: 'viewport', content: 'width=device-width, initial-scale=1'},
        {title: site.title},
        {name: 'description', content: site.description},
        ...ogTags(social),
      ],
      links: [
        {rel: 'canonical', href: String(social.url)},
        // Declared on the root route so every page inherits it; child routes
        // override title/description but never the mark.
        {rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg'},
        {rel: 'stylesheet', href: appCss},
      ],
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className={css({bg: 'white', color: 'neutral.900', fontFamily: 'sans'})}>
        {/* Resolves the persisted (or OS) color scheme before first paint.
            Every page shares the diffs theme, so the scheme is applied once
            here on the shell rather than by per-route head scripts. */}
        <ScriptOnce>{themeBootstrapScript}</ScriptOnce>
        {children}
        <TanStackDevtools
          config={{position: 'bottom-right'}}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
