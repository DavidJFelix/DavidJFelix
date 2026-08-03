// Stays app-local. The diffs-specific mapping from neutral ChromeTokens to
// the app's CSS variables — preserved byte-for-byte from the previous
// buildThemeChromeStyle (the --diffs-*/--*/--foreground vocabulary plus
// the app-only --diffs-card-* (6/12/12) and annotation-hover-border (28%)
// mixes). Only the handful of diffs-specific surfaces the neutral set does
// not carry are derived locally from the same foreground/surface pair.
import type {ThemeLike} from '@pierre/theming'
import {normalizeThemeColors} from '@pierre/theming/color'
import type {CSSProperties} from 'react'
import {isNullish} from '../nullish'
import type {ChromeTokens} from './derive-chrome-tokens'

// A ChromeMapping turns the neutral chrome tokens (or undefined when the theme
// has no legible foreground) plus the source theme into a host CSS style. The
// theme is passed so a mapping can read the sidebar background for the surface
// the mixes blend into.
export type ChromeMapping = (
  chrome: ChromeTokens | undefined,
  theme: ThemeLike,
) => CSSProperties | undefined

export const diffsChromeMapping: ChromeMapping = (chrome, theme) => {
  // Mirror the previous behavior: the chrome background is the resolved theme's
  // sidebar background, read straight from the shared normalizeThemeColors
  // surface derivation (the same key trees and deriveChromeTokens read).
  const sidebarBg = normalizeThemeColors(theme).colors?.['sideBar.background']
  const bg = typeof sidebarBg === 'string' && sidebarBg !== '' ? sidebarBg : undefined

  // No chrome means deriveChromeTokens found no legible foreground (degenerate
  // bg-only theme). Mirror the previous behavior: paint just the background when
  // we have one, otherwise contribute nothing.
  if (isNullish(chrome)) {
    return !isNullish(bg) ? ({backgroundColor: bg} as CSSProperties) : undefined
  }

  const fg = chrome.fg
  // The base the diffs-specific card mixes blend the foreground into. Mirror
  // the previous `bg ?? 'transparent'` fallback exactly.
  const base = bg ?? 'transparent'
  const style: CSSProperties & Record<string, string> = {}
  if (!isNullish(bg)) style.backgroundColor = bg
  style.color = fg
  // Each semantic color is emitted twice: as the base variable (consumed by
  // raw var() references and third-party CSS) and as the Panda token variable
  // (--colors-diffs-*). The token variables resolve their var(--x) indirection
  // at :root, so a subtree override must set the token variable itself for
  // Panda-styled components to pick up the themed chrome — the same reason the
  // upstream app emitted Tailwind's --color-* names alongside the base vars.
  style['--colors-diffs-foreground'] = fg
  style['--foreground'] = fg
  style['--colors-diffs-muted-foreground'] = chrome.mutedFg
  style['--muted-foreground'] = chrome.mutedFg
  style['--colors-diffs-border'] = chrome.border
  style['--border'] = chrome.border
  style['--colors-diffs-border-opaque'] = chrome.borderOpaque
  style['--border-opaque'] = chrome.borderOpaque
  // diffs-specific card surfaces: a touch softer than the popover (6/12/12
  // vs the neutral 7/14/20 set), so they read as quiet inline rows rather than
  // floating menus. Not part of the shared ChromeTokens.
  style['--diffs-card-bg'] = `color-mix(in srgb, ${fg} 6%, ${base})`
  style['--diffs-card-hover-bg'] = `color-mix(in srgb, ${fg} 12%, ${base})`
  style['--diffs-card-border'] = `color-mix(in srgb, ${fg} 12%, ${base})`
  style['--diffs-popover-bg'] = chrome.surface
  style['--diffs-popover-fg'] = fg
  style['--diffs-popover-muted-fg'] = chrome.mutedFg
  style['--diffs-popover-hover-bg'] = chrome.surfaceHover
  style['--diffs-popover-selected-bg'] = chrome.surfaceSelected
  style['--diffs-popover-border'] = chrome.surfaceBorder
  style['--diffs-popover-shadow'] = chrome.surfaceShadow
  style['--diffs-annotation-bg'] = chrome.surface
  style['--diffs-annotation-fg'] = fg
  style['--diffs-annotation-border'] = chrome.surfaceBorder
  style['--diffs-annotation-hover-border'] = `color-mix(in srgb, ${fg} 28%, ${base})`
  style['--diffs-annotation-shadow'] = chrome.surfaceShadow
  style['--colors-diffs-popover'] = chrome.surface
  style['--popover'] = chrome.surface
  style['--colors-diffs-popover-foreground'] = fg
  style['--popover-foreground'] = fg
  // card has no Panda token (components read it through raw var() fallbacks),
  // so only the base variables are emitted.
  style['--card'] = chrome.surface
  style['--card-foreground'] = fg
  style['--colors-diffs-background'] = chrome.background
  style['--background'] = chrome.background
  style['--colors-diffs-accent'] = chrome.surfaceHover
  style['--accent'] = chrome.surfaceHover
  style['--colors-diffs-accent-foreground'] = fg
  style['--accent-foreground'] = fg
  // `secondary` is the segmented-control (ButtonGroup) track. It must sit
  // visibly behind the buttons so the Auto/Light/Dark options read as one
  // connected control, so it reuses the slightly stronger hover mix.
  style['--colors-diffs-secondary'] = chrome.surfaceHover
  style['--secondary'] = chrome.surfaceHover
  style['--colors-diffs-secondary-foreground'] = fg
  style['--secondary-foreground'] = fg
  style['--colors-diffs-input'] = chrome.surfaceHover
  style['--input'] = chrome.surfaceHover
  style['--colors-diffs-muted'] = chrome.surfaceHover
  style['--muted'] = chrome.surfaceHover
  style['--colors-diffs-primary'] = fg
  style['--primary'] = fg
  style['--colors-diffs-primary-foreground'] = chrome.background
  style['--primary-foreground'] = chrome.background
  style['--colors-diffs-ring'] = chrome.ring
  style['--ring'] = chrome.ring
  style['--diffs-comment-add-fg'] = chrome.additionFg
  style['--diffs-comment-del-fg'] = chrome.deletionFg
  style['--diffs-diff-separator'] = chrome.separator
  if (!isNullish(chrome.scrollbarThumb)) {
    style['--diffs-scrollbar-thumb-bg'] = chrome.scrollbarThumb
  }
  if (!isNullish(chrome.scrollbarTrack)) {
    style['--diffs-scrollbar-track-bg'] = chrome.scrollbarTrack
  }
  return style as CSSProperties
}
