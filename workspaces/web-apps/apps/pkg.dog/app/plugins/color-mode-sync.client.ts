import {defineNuxtPlugin} from '#imports'
import {parseThemePreference} from '../../shared/theme-preference'

// @nuxtjs/color-mode persists the preference to localStorage but has no
// `storage` event listener (verified against its source: dist/runtime/
// plugin.client.js only writes on preference change, never reads on storage
// events), so a choice made in one tab never reaches an already-open tab.
// This plugin closes that gap for the repo-wide theme contract.
export default defineNuxtPlugin(() => {
  const colorMode = useColorMode()

  window.addEventListener('storage', (event) => {
    // key === null means the whole store was cleared; re-read either way.
    if (event.key !== null && event.key !== 'theme') {
      return
    }
    let stored: string | null = null
    try {
      stored = window.localStorage?.getItem('theme') ?? null
    } catch {
      // Storage may be unavailable (private mode / denied) -- non-fatal.
    }
    colorMode.preference = parseThemePreference(stored)
  })
})
