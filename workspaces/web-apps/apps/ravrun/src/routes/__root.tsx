import {createThemeBootstrapScript} from '@davidjfelix/theme/bootstrap'
import {ThemeProvider} from '@davidjfelix/theme/react'
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  ScriptOnce,
  Scripts,
} from '@tanstack/react-router'
import React from 'react'
import appCss from '../styles.css?url'
import {ThemeToggle} from '../theme/theme-toggle'

const TanStackRouterDevtools =
  process.env.NODE_ENV === 'production'
    ? () => null // Render nothing in production
    : React.lazy(() =>
        // Lazy load in development
        import('@tanstack/router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
          // For Embedded Mode
          // default: res.TanStackRouterDevtoolsPanel
        })),
      )

const themeBootstrapScript = createThemeBootstrapScript({storageKey: 'theme'})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1.0'},
      {
        name: 'description',
        content:
          'Tell ravrun your race and current fitness; get a phased, paced training plan you can share as a link and export to your calendar.',
      },
      {title: 'ravrun — training plan generator'},
    ],
    links: [{rel: 'stylesheet', href: appCss}],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Resolves the persisted (or OS) color scheme before first paint so
            the page never flashes the wrong scheme. SPA mode prerenders this
            shell at build, so the script ships in the static HTML exactly
            like the Start apps' server-rendered documents. */}
        <ScriptOnce>{themeBootstrapScript}</ScriptOnce>
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  return (
    <>
      <div className="p-2 flex gap-4 text-lg items-baseline">
        <span className="font-bold tracking-tight">ravrun</span>
        <Link
          to="/"
          activeProps={{
            className: 'font-bold',
          }}
          activeOptions={{exact: true}}
        >
          Home
        </Link>{' '}
        <Link
          to="/about"
          activeProps={{
            className: 'font-bold',
          }}
        >
          About
        </Link>
        <ThemeToggle />
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
