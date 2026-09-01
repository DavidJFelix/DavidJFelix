import {ogTags} from '@davidjfelix/og'
import {createThemeBootstrapScript, type ThemeColorPair} from '@davidjfelix/theme/bootstrap'
import {ThemeProvider} from '@davidjfelix/theme/react'
import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, ScriptOnce, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'
import {css} from 'styled-system/css'
import appCss from '../styles.css?url'

const TITLE = 'onvibes.org'
const DESCRIPTION =
  'A showcase of vibecoded apps — built fast and by feel — and a toolchain for building your own.'

// Navbar tint (iOS Safari's <meta name="theme-color">) for each resolved
// color scheme; matches the bg.canvas semantic token (panda.config.ts).
const THEME_COLORS: ThemeColorPair = {light: '#ffffff', dark: '#0a0a0a'}

const themeBootstrapScript = createThemeBootstrapScript({
  storageKey: 'theme',
  themeColors: THEME_COLORS,
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width, initial-scale=1'},
      {title: TITLE},
      {name: 'description', content: DESCRIPTION},
      ...ogTags({
        title: TITLE,
        description: DESCRIPTION,
        type: 'website',
        siteName: TITLE,
      }),
    ],
    links: [{rel: 'stylesheet', href: appCss}],
  }),
  shellComponent: RootDocument,
})

function RootDocument({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className={css({bg: 'bg.canvas', color: 'text', fontFamily: 'sans'})}>
        {/* Resolves the persisted (or OS) color scheme before first paint so
            the page never flashes the wrong scheme. */}
        <ScriptOnce>{themeBootstrapScript}</ScriptOnce>
        <ThemeProvider themeColors={THEME_COLORS}>{children}</ThemeProvider>
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
