// Pre-paint scheme bootstrap for the routes that load diffs.css (the home page
// and the /diffs layout): applies the persisted (or OS) color scheme to <html>
// before first paint so a themed page never flashes the wrong scheme.
//
// The color literals mirror SCHEME_THEME_COLOR in
// components/theme-provider.tsx; keep them in sync. This function is
// stringified and inlined into the document head, so its body can reference
// nothing outside itself -- no imports, which is why the null check is spelled
// out instead of using lib/nullish. The <meta name="theme-color"> is created
// here (not authored in JSX, which React 19 would hoist into a duplicate) and
// owned by JS thereafter.
export const themeBootstrapScript = `(${String(function applyInitialTheme() {
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
})})()`
