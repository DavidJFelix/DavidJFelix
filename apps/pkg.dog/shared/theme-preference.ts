// Pure parsing of a stored theme preference, split out of
// app/plugins/color-mode-sync.client.ts so it is unit-testable without a Nuxt
// runtime context (that plugin imports '#imports', which only resolves inside
// a Nuxt build). Absent or invalid means 'system' -- the same rule the
// @nuxtjs/color-mode pre-paint bootstrap script applies.

export type ThemePreference = 'light' | 'dark' | 'system'

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}
