// Pre-paint scheme bootstrap: applies the persisted (or OS) color scheme to
// <html> before first paint so a themed page never flashes the wrong scheme.
//
// applyInitialTheme is authored as a real function so the type checker, linter,
// and unit tests cover it, then stringified by createThemeBootstrapScript into
// an inline script -- the only code that can run before first paint. Its body
// must therefore be self-contained: no references outside its own scope. The
// options object is serialized into the script alongside it, which is what
// keeps storage key and theme-color literals out of the function body.
//
// ravrun is a client-only SPA (no ScriptOnce/SSR host), so its actual
// pre-paint script is inlined literally as the first element of index.html's
// <head>, not generated from createThemeBootstrapScript. This module still
// exists so the logic stays typed, linted, and unit tested; keep the two
// copies in sync by hand when the contract changes.

export interface ThemeColorPair {
  light: string
  dark: string
}

export interface ThemeBootstrapOptions {
  storageKey: string
  // Per-scheme <meta name="theme-color"> content (the iOS Safari navbar tint).
  // Omit for apps that do not manage the meta. The meta is created here (not
  // authored in JSX, which React 19 would hoist into a duplicate) and owned by
  // JS thereafter.
  themeColors?: ThemeColorPair
}

// Exported for direct unit testing; production code should only ever ship it
// through createThemeBootstrapScript.
export function applyInitialTheme(options: {
  storageKey: string
  themeColors?: {light: string; dark: string}
}) {
  try {
    const storedMode = window.localStorage.getItem(options.storageKey)
    const mode = storedMode === 'light' || storedMode === 'dark' ? storedMode : 'system'
    const resolvedScheme =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode
    const root = document.documentElement

    root.classList.remove('light', 'dark')
    root.classList.add(resolvedScheme)
    root.style.colorScheme = resolvedScheme
    // The raw mode rides along as a data attribute so tri-state UI (the toggle
    // icons) can be styled by CSS alone, before any framework hydrates.
    root.setAttribute('data-theme-mode', mode)

    if (options.themeColors !== undefined) {
      let themeColorMeta = document.querySelector('meta[name="theme-color"]')
      if (themeColorMeta === null) {
        themeColorMeta = document.createElement('meta')
        themeColorMeta.setAttribute('name', 'theme-color')
        document.head.appendChild(themeColorMeta)
      }
      themeColorMeta.setAttribute(
        'content',
        resolvedScheme === 'dark' ? options.themeColors.dark : options.themeColors.light,
      )
    }
  } catch {
    // Ignore storage/media failures and let CSS defaults apply.
  }
}

// Parenthesized and called because a stringified declaration would only
// declare: this is what makes the inline script actually invoke it.
export function createThemeBootstrapScript(options: ThemeBootstrapOptions): string {
  return `(${String(applyInitialTheme)})(${JSON.stringify(options)})`
}
