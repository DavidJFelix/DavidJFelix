// → future @pierre/trees. Pure mapping from the resolved active theme to the
// FileTree style props. Equals themeToTreeStyles(active.theme), plus an opt-in
// contrast-based foreground upgrade that diffs relies on (preserved exactly
// from the previous buildResolvedTheme so file rows match the chrome instead of
// a dim sideBar.foreground).
import {type TreeThemeStyles, themeToTreeStyles} from '@pierre/trees'
import {isNullish} from '../nullish'
import {deriveChromeTokens} from './derive-chrome-tokens'
import type {ActiveThemeSnapshot} from './theme-source'

export interface TreeThemePropsOptions {
  // When true, compare deriveChromeTokens(active.theme)?.fg against the theme's
  // raw sideBar.foreground; when they disagree, overwrite the tree's
  // unconditional foreground fallbacks so file rows match the chrome. Tokens the
  // theme sets explicitly keep their intended values. Off by default; diffs
  // turns it on to preserve its current behavior.
  reconcileForegroundFromChrome?: boolean
}

export function treeThemeProps(
  active: ActiveThemeSnapshot,
  options: TreeThemePropsOptions = {},
): {style: TreeThemeStyles} {
  const theme = active.theme
  if (isNullish(theme)) return {style: {}}

  const treeStyles = themeToTreeStyles(theme)
  if (options.reconcileForegroundFromChrome === true) {
    const c = theme.colors ?? {}
    const primaryFg = deriveChromeTokens(theme)?.fg
    // themeToTreeStyles pulls its text color tokens straight from
    // sideBar.foreground; when the contrast-based pick disagrees with that raw
    // value, overwrite the tree's tokens so the file rows match the chrome
    // instead of staying on the dim original. Tokens the theme sets explicitly
    // (sideBarSectionHeader.foreground, list.activeSelectionForeground) keep
    // their intended values — we only upgrade the unconditional fallbacks.
    if (!isNullish(primaryFg) && primaryFg !== c['sideBar.foreground'] && primaryFg !== '') {
      treeStyles.color = primaryFg
      treeStyles['--trees-theme-sidebar-fg'] = primaryFg
      if (isNullish(c['sideBarSectionHeader.foreground'])) {
        treeStyles['--trees-theme-sidebar-header-fg'] = primaryFg
      }
      if (isNullish(c['list.activeSelectionForeground'])) {
        treeStyles['--trees-theme-list-active-selection-fg'] = primaryFg
      }
      if (
        isNullish(c['list.focusOutline']) &&
        isNullish(c.focusBorder) &&
        isNullish(c['sideBar.foreground'])
      ) {
        treeStyles['--trees-theme-focus-ring'] = primaryFg
      }
    }
  }

  return {style: treeStyles}
}
