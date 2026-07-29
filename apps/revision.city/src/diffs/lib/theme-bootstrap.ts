// Pre-paint scheme bootstrap: applies the persisted (or OS) color scheme to
// <html> before first paint so a themed page never flashes the wrong scheme.
// The root document ships it through ScriptOnce, so it executes while the
// initial HTML is parsing and never re-runs on hydration or SPA navigation.
//
// applyInitialTheme never runs in this module. It is authored as a real
// function so the type checker and linter cover it, then stringified below
// into the script ScriptOnce inlines -- the only code that can run before
// first paint. That also means its body must be self-contained: no references
// outside itself, which is why the null check is spelled out instead of using
// lib/nullish. The color literals mirror SCHEME_THEME_COLOR in
// components/theme-provider.tsx; keep them in sync. The <meta
// name="theme-color"> is created here (not authored in JSX, which React 19
// would hoist into a duplicate) and owned by JS thereafter.
function applyInitialTheme() {
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
    if (themeColorMeta === null) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      // appendChild, not append: @cloudflare/workers-types merges its
      // HTMLRewriter Element into the global, and its append() signature wins.
      document.head.appendChild(themeColorMeta)
    }
    themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff')
  } catch {
    // Ignore storage/media failures and let CSS defaults apply.
  }
}

// Parenthesized and called because a stringified declaration would only
// declare: this is what makes the inline script actually invoke it.
export const themeBootstrapScript = `(${String(applyInitialTheme)})()`
