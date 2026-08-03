import darkSoftTheme from '@pierre/theme/pierre-dark-soft'
import lightSoftTheme from '@pierre/theme/pierre-light-soft'
import type {ThemeLike} from '@pierre/theming'
import type {CSSProperties} from 'react'
import {expect, test} from 'vitest'

import {chromeThemeProps} from './chrome-theme-props'
import {diffsChromeMapping} from './diffs-chrome-mapping'

// Golden chrome styles captured from the pre-theming buildThemeChromeStyle for
// the two default Pierre soft themes. These lock that the chromeThemeProps +
// diffsChromeMapping pipeline is byte-for-byte identical to the app's
// previous, pre-theming chrome build.
const LIGHT_SOFT_CHROME: Record<string, string> = {
  backgroundColor: '#f7f7f7',
  color: '#737373',
  '--colors-diffs-foreground': '#737373',
  '--foreground': '#737373',
  '--colors-diffs-muted-foreground': '#737373',
  '--muted-foreground': '#737373',
  '--colors-diffs-border': 'color-mix(in srgb, #737373 20%, transparent)',
  '--border': 'color-mix(in srgb, #737373 20%, transparent)',
  '--colors-diffs-border-opaque': 'color-mix(in srgb, #737373 22%, #f7f7f7)',
  '--border-opaque': 'color-mix(in srgb, #737373 22%, #f7f7f7)',
  '--diffs-card-bg': 'color-mix(in srgb, #737373 6%, #f7f7f7)',
  '--diffs-card-hover-bg': 'color-mix(in srgb, #737373 12%, #f7f7f7)',
  '--diffs-card-border': 'color-mix(in srgb, #737373 12%, #f7f7f7)',
  '--diffs-popover-bg': 'color-mix(in srgb, #737373 7%, #f7f7f7)',
  '--diffs-popover-fg': '#737373',
  '--diffs-popover-muted-fg': '#737373',
  '--diffs-popover-hover-bg': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--diffs-popover-selected-bg': 'color-mix(in srgb, #737373 20%, #f7f7f7)',
  '--diffs-popover-border': 'color-mix(in srgb, #737373 18%, #f7f7f7)',
  '--diffs-popover-shadow': '0 8px 16px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.05)',
  '--diffs-annotation-bg': 'color-mix(in srgb, #737373 7%, #f7f7f7)',
  '--diffs-annotation-fg': '#737373',
  '--diffs-annotation-border': 'color-mix(in srgb, #737373 18%, #f7f7f7)',
  '--diffs-annotation-hover-border': 'color-mix(in srgb, #737373 28%, #f7f7f7)',
  '--diffs-annotation-shadow': '0 8px 16px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.05)',
  '--colors-diffs-popover': 'color-mix(in srgb, #737373 7%, #f7f7f7)',
  '--popover': 'color-mix(in srgb, #737373 7%, #f7f7f7)',
  '--colors-diffs-popover-foreground': '#737373',
  '--popover-foreground': '#737373',
  // card has no Panda token; only the base variables are emitted.
  '--card': 'color-mix(in srgb, #737373 7%, #f7f7f7)',
  '--card-foreground': '#737373',
  '--colors-diffs-background': '#f7f7f7',
  '--background': '#f7f7f7',
  '--colors-diffs-accent': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--accent': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--colors-diffs-accent-foreground': '#737373',
  '--accent-foreground': '#737373',
  '--colors-diffs-secondary': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--secondary': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--colors-diffs-secondary-foreground': '#737373',
  '--secondary-foreground': '#737373',
  '--colors-diffs-input': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--input': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--colors-diffs-muted': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--muted': 'color-mix(in srgb, #737373 14%, #f7f7f7)',
  '--colors-diffs-primary': '#737373',
  '--primary': '#737373',
  '--colors-diffs-primary-foreground': '#f7f7f7',
  '--primary-foreground': '#f7f7f7',
  '--colors-diffs-ring': '#737373',
  '--ring': '#737373',
  '--diffs-comment-add-fg': '#047857',
  '--diffs-comment-del-fg': '#be123c',
  '--diffs-diff-separator': 'color-mix(in srgb, #525252 22%, #ffffff)',
  '--diffs-scrollbar-thumb-bg': 'color-mix(in lab, #ffffff 85%, black)',
  '--diffs-scrollbar-track-bg': '#ffffff',
}

const DARK_SOFT_CHROME: Record<string, string> = {
  backgroundColor: '#101010',
  color: '#8a8a8a',
  '--colors-diffs-foreground': '#8a8a8a',
  '--foreground': '#8a8a8a',
  '--colors-diffs-muted-foreground': '#7e7e7e',
  '--muted-foreground': '#7e7e7e',
  '--colors-diffs-border': 'color-mix(in srgb, #8a8a8a 20%, transparent)',
  '--border': 'color-mix(in srgb, #8a8a8a 20%, transparent)',
  '--colors-diffs-border-opaque': 'color-mix(in srgb, #8a8a8a 22%, #101010)',
  '--border-opaque': 'color-mix(in srgb, #8a8a8a 22%, #101010)',
  '--diffs-card-bg': 'color-mix(in srgb, #8a8a8a 6%, #101010)',
  '--diffs-card-hover-bg': 'color-mix(in srgb, #8a8a8a 12%, #101010)',
  '--diffs-card-border': 'color-mix(in srgb, #8a8a8a 12%, #101010)',
  '--diffs-popover-bg': 'color-mix(in srgb, #8a8a8a 7%, #101010)',
  '--diffs-popover-fg': '#8a8a8a',
  '--diffs-popover-muted-fg': '#7e7e7e',
  '--diffs-popover-hover-bg': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--diffs-popover-selected-bg': 'color-mix(in srgb, #8a8a8a 20%, #101010)',
  '--diffs-popover-border': 'color-mix(in srgb, #8a8a8a 18%, #101010)',
  '--diffs-popover-shadow': '0 8px 16px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.05)',
  '--diffs-annotation-bg': 'color-mix(in srgb, #8a8a8a 7%, #101010)',
  '--diffs-annotation-fg': '#8a8a8a',
  '--diffs-annotation-border': 'color-mix(in srgb, #8a8a8a 18%, #101010)',
  '--diffs-annotation-hover-border': 'color-mix(in srgb, #8a8a8a 28%, #101010)',
  '--diffs-annotation-shadow': '0 8px 16px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.05)',
  '--colors-diffs-popover': 'color-mix(in srgb, #8a8a8a 7%, #101010)',
  '--popover': 'color-mix(in srgb, #8a8a8a 7%, #101010)',
  '--colors-diffs-popover-foreground': '#8a8a8a',
  '--popover-foreground': '#8a8a8a',
  // card has no Panda token; only the base variables are emitted.
  '--card': 'color-mix(in srgb, #8a8a8a 7%, #101010)',
  '--card-foreground': '#8a8a8a',
  '--colors-diffs-background': '#101010',
  '--background': '#101010',
  '--colors-diffs-accent': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--accent': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--colors-diffs-accent-foreground': '#8a8a8a',
  '--accent-foreground': '#8a8a8a',
  '--colors-diffs-secondary': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--secondary': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--colors-diffs-secondary-foreground': '#8a8a8a',
  '--secondary-foreground': '#8a8a8a',
  '--colors-diffs-input': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--input': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--colors-diffs-muted': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--muted': 'color-mix(in srgb, #8a8a8a 14%, #101010)',
  '--colors-diffs-primary': '#8a8a8a',
  '--primary': '#8a8a8a',
  '--colors-diffs-primary-foreground': '#101010',
  '--primary-foreground': '#101010',
  '--colors-diffs-ring': '#8a8a8a',
  '--ring': '#8a8a8a',
  '--diffs-comment-add-fg': '#34d399',
  '--diffs-comment-del-fg': '#fb7185',
  '--diffs-diff-separator': 'color-mix(in srgb, #8a8a8a 22%, #101010)',
  '--diffs-scrollbar-thumb-bg': 'color-mix(in lab, #171717 80%, white)',
  '--diffs-scrollbar-track-bg': '#171717',
}

test('chromeThemeProps + diffsChromeMapping: matches the pre-theming chrome byte-for-byte (pierre-light-soft)', () => {
  const {style} = chromeThemeProps(
    {theme: lightSoftTheme as ThemeLike, colorScheme: 'light'},
    diffsChromeMapping,
  )
  expect(style).toEqual(LIGHT_SOFT_CHROME as CSSProperties)
})

test('chromeThemeProps + diffsChromeMapping: matches the pre-theming chrome byte-for-byte (pierre-dark-soft)', () => {
  const {style} = chromeThemeProps(
    {theme: darkSoftTheme as ThemeLike, colorScheme: 'dark'},
    diffsChromeMapping,
  )
  expect(style).toEqual(DARK_SOFT_CHROME as CSSProperties)
})

test('chromeThemeProps + diffsChromeMapping: returns an empty style when no theme is resolved yet', () => {
  expect(
    chromeThemeProps({theme: undefined, colorScheme: 'light'}, diffsChromeMapping).style,
  ).toEqual({})
})
