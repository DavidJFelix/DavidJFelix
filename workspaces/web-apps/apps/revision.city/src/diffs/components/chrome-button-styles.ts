import {css} from 'styled-system/css'

// Shared styling for ghost icon buttons that sit directly on the themed Shiki
// chrome (the header action row and the sidebar's tools). They remove the
// default ghost hover background and the focus-visible ring and border, so the
// buttons stay flush with the chrome surface. Hover shows a foreground color
// change. Keyboard focus shows a 2px outline in currentColor, the chrome text
// color of the active theme. The outline color is !important because the
// global outline-color rule in diffs.css is outside the cascade layers, so it
// wins over all layered Panda rules.
// The [data-slot="button"] wrapper raises specificity above the Button
// recipe's own hover/focus rules, since Panda's cx concatenates rather than
// merges conflicting utilities.
export const CHROME_ICON_BUTTON_CLASS = css({
  '&[data-slot="button"]': {
    _hover: {bg: 'transparent', color: 'diffs.muted.foreground'},
    _focusVisible: {
      borderColor: 'transparent',
      boxShadow: '[none]',
      outline: '[2px solid]',
      outlineColor: 'currentColor !important',
      outlineOffset: '[1px]',
    },
  },
})
