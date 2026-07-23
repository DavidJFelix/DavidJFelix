import {css} from 'styled-system/css'

// Shared styling for ghost icon buttons that sit directly on the themed Shiki
// chrome (the header action row and the sidebar's tools). They suppress the
// default ghost hover background and the focus-visible ring/border so the
// buttons stay flush with the chrome surface, signalling both hover and
// keyboard focus with a foreground-color shift instead of a filled background.
// The [data-slot="button"] wrapper raises specificity above the Button
// recipe's own hover/focus rules, since Panda's cx concatenates rather than
// merges conflicting utilities.
export const CHROME_ICON_BUTTON_CLASS = css({
  '&[data-slot="button"]': {
    _hover: {bg: 'transparent', color: 'diffs.muted.foreground'},
    _focusVisible: {
      borderColor: 'transparent',
      color: 'diffs.muted.foreground',
      boxShadow: 'none',
    },
  },
})
