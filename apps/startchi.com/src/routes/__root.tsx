import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, ScriptOnce, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'

import {css} from 'styled-system/css'

import {createThemeBootstrapScript, type ThemeColorPair} from '@/theme/theme-bootstrap'
import {ThemeProvider} from '@/theme/theme-provider'
import appCss from '../styles.css?url'

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
      {title: 'startchi.com'},
      {name: 'description', content: 'startchi.com'},
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
