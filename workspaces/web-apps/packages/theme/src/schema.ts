// The vocabulary of the repo theming contract (see
// docs/projects/theme-switcher-unification/plan.md): the storage schema, the
// mode list, and the toggle cycle order. Every other module derives from this
// one so the contract has a single source of truth.

import * as z from 'zod/mini'

// The storage schema: the `theme` localStorage key holds one of these raw
// strings -- never JSON, because the pre-paint bootstrap must read it without
// parsing -- and anything else (absent, cleared, garbage) parses to system.
// zod/mini keeps the client bundle cost to the schema used. The bootstrap's
// self-contained literal check in bootstrap.ts is this schema's compiled
// twin; keep the two in agreement.
const themeModeEnum = z.enum(['light', 'dark', 'system'])
export const themeModeSchema = z.catch(themeModeEnum, 'system')

export type ThemeMode = z.infer<typeof themeModeEnum>
export type ResolvedColorScheme = 'light' | 'dark'

export const THEME_MODES: ThemeMode[] = [...themeModeEnum.options]

// Toggle cycle order: each press moves to the next mode, so all three states
// stay reachable from a single button (system is never a dead end).
export const NEXT_THEME_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}
