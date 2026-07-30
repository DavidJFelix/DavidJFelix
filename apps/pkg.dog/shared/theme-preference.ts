// The repo theming contract's storage schema (zod 4, see
// docs/projects/theme-switcher-unification/plan.md): the `theme` key holds a
// raw mode string -- never JSON -- and absent or invalid parses to 'system',
// the same rule the @nuxtjs/color-mode pre-paint bootstrap script applies.
// Split out of app/plugins/color-mode-sync.client.ts so it is unit-testable
// without a Nuxt runtime context (that plugin imports '#imports', which only
// resolves inside a Nuxt build).

import * as z from 'zod/mini'

const themePreferenceEnum = z.enum(['light', 'dark', 'system'])
export const themePreferenceSchema = z.catch(themePreferenceEnum, 'system')

export type ThemePreference = z.infer<typeof themePreferenceEnum>

export function parseThemePreference(value: string | null): ThemePreference {
  return themePreferenceSchema.parse(value)
}
