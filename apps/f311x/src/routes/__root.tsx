import {createThemeBootstrapScript, type ThemeColorPair} from '@davidjfelix/theme/bootstrap'
import {ThemeProvider} from '@davidjfelix/theme/react'
import {TanStackDevtools} from '@tanstack/react-devtools'
import {createRootRoute, HeadContent, ScriptOnce, Scripts} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'
import appCss from '../styles.css?url'

// Navbar tint (iOS Safari's <meta name="theme-color">) for each resolved color
// scheme; matches the body --background values in styles.css (oklch(1 0 0) /
// oklch(0.145 0 0)).
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
      {title: 'f311x'},
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
      <body className="bg-background text-foreground font-sans antialiased">
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
