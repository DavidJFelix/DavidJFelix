// Vanilla DOM binding of the theming contract for framework-free pages (the
// Astro apps): cycles the mode from an existing button, keeps the accessible
// label naming the mode a press will switch to, follows live OS preference
// changes while in system mode, and adopts other tabs' choices. The pre-paint
// bootstrap (./bootstrap) owns first paint and is the source of truth this
// binding reads back through the data-theme-mode attribute; markup and styling
// stay with the consuming app.

import {NEXT_THEME_MODE, type ThemeMode, themeModeSchema} from './schema'

export interface ThemeToggleOptions {
  storageKey?: string
}

export function bindThemeToggle(toggle: HTMLButtonElement, options: ThemeToggleOptions = {}): void {
  const {storageKey = 'theme'} = options

  function currentMode(): ThemeMode {
    return themeModeSchema.parse(document.documentElement.dataset.themeMode)
  }

  function updateLabel(mode: ThemeMode): void {
    const label = `Switch to ${NEXT_THEME_MODE[mode]} theme`
    toggle.setAttribute('aria-label', label)
    toggle.setAttribute('title', label)
  }

  function apply(mode: ThemeMode): void {
    const resolved =
      mode === 'system'
        ? matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
    root.style.colorScheme = resolved
    root.dataset.themeMode = mode
    updateLabel(mode)
  }

  // The server markup carries a static label ("Toggle color theme"); replace
  // it with the mode-specific one as soon as the binding runs, same as the CSS
  // icon swap, before any interaction.
  updateLabel(currentMode())

  toggle.addEventListener('click', () => {
    const next = NEXT_THEME_MODE[currentMode()]
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Storage may be unavailable (private mode / denied) -- still apply
      // in-memory.
    }
    apply(next)
  })

  // Live OS tracking: while the mode is 'system', a change in the OS
  // preference re-resolves the scheme without a reload.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentMode() === 'system') apply('system')
  })

  // Cross-tab sync: another tab's choice (or a cleared store) is reflected
  // here too. key === null means the whole store was cleared.
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== storageKey) return
    let stored: string | null = null
    try {
      stored = localStorage.getItem(storageKey)
    } catch {
      // Unreadable storage parses to system, same as the controller.
    }
    apply(themeModeSchema.parse(stored))
  })
}
