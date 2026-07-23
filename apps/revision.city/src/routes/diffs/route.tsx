import {createFileRoute, Outlet} from '@tanstack/react-router'

import {PreloadHighlighter} from '@/diffs/components/PreloadHighlighter'
import {ScrollbarGutterVariables} from '@/diffs/components/ScrollbarGutterVariables'
import {ThemeProvider} from '@/diffs/components/ThemeProvider'
import {Toaster} from '@/diffs/components/Toaster'
import {WorkerPoolContext} from '@/diffs/components/WorkerPoolContext'
import diffsCss from '@/diffs/diffs.css?url'
import {isNullish} from '@/diffs/lib/nullish'
import {SITE_DESCRIPTION, SITE_NAME} from '@/diffs/lib/site'

// Applies the persisted (or OS) color scheme to <html> before first paint so
// the diffs UI never flashes the wrong scheme. The literals mirror
// SCHEME_THEME_COLOR in ThemeProvider.tsx (this stringified script can't
// import it); keep them in sync. The <meta name="theme-color"> is created here
// (not authored in JSX, which React 19 would hoist into a duplicate) and owned
// by JS thereafter.
const themeBootstrapScript = `(${String(function applyInitialTheme() {
  try {
    const storedTheme = window.localStorage.getItem('theme')
    const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system'
    const resolvedTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme
    const root = document.documentElement

    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme

    let themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (isNullish(themeColorMeta)) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.appendChild(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff')
  } catch {
    // Ignore storage/media failures and let CSS defaults apply.
  }
})})()`

export const Route = createFileRoute('/diffs')({
  head: () => ({
    meta: [
      {title: `${SITE_NAME} · revision.city`},
      {name: 'description', content: SITE_DESCRIPTION},
      // The diffs surface is a full-viewport app; lock the scale and extend
      // into the safe areas like the source app did.
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      },
    ],
    links: [{rel: 'stylesheet', href: diffsCss}],
    scripts: [{children: themeBootstrapScript}],
  }),
  component: DiffsLayout,
})

function DiffsLayout() {
  return (
    <>
      <ScrollbarGutterVariables />
      <WorkerPoolContext>
        <ThemeProvider attribute="class">
          <Outlet />
          <Toaster />
          <div id="dark-mode-portal-container" className="dark" data-theme="dark"></div>
          <div id="light-mode-portal-container" className="light" data-theme="light"></div>
        </ThemeProvider>
      </WorkerPoolContext>
      <PreloadHighlighter />
    </>
  )
}
