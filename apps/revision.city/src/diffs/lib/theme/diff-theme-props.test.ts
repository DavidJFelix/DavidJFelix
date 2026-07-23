import type {ThemeLike} from '@pierre/theming'
import {expect, test} from 'vitest'

import {type DiffThemeInput, diffThemeProps, diffThemeSelectionFromInput} from './diff-theme-props'

const loadedLightTheme = {
  name: 'loaded-light-test',
  type: 'light',
  colors: {'editor.background': '#fff'},
} satisfies ThemeLike & {name: string}

const loadedDarkTheme = {
  name: 'loaded-dark-test',
  type: 'dark',
  colors: {'editor.background': '#000'},
} satisfies ThemeLike & {name: string}

function acceptDiffThemeInput(_input: DiffThemeInput): void {}

test('diffThemeProps: passes selection names through as { theme, themeType }', () => {
  expect(
    diffThemeProps({
      lightThemeName: 'github-light',
      darkThemeName: 'ayu-dark',
      colorScheme: 'dark',
    }),
  ).toEqual({
    theme: {light: 'github-light', dark: 'ayu-dark'},
    themeType: 'dark',
  })
})

test('diffThemeProps: themeType follows the selection colorScheme', () => {
  expect(
    diffThemeProps({
      lightThemeName: 'a',
      darkThemeName: 'b',
      colorScheme: 'light',
    }).themeType,
  ).toBe('light')
})

test('diffThemeSelectionFromInput: single fixed theme inputs resolve to the same light and dark name', () => {
  expect(diffThemeSelectionFromInput('fixed-theme', 'dark')).toEqual({
    lightThemeName: 'fixed-theme',
    darkThemeName: 'fixed-theme',
    colorScheme: 'dark',
  })
})

test('diffThemeSelectionFromInput: { light, dark } inputs resolve to matching light and dark names', () => {
  expect(diffThemeSelectionFromInput({light: 'pair-light', dark: 'pair-dark'}, 'light')).toEqual({
    lightThemeName: 'pair-light',
    darkThemeName: 'pair-dark',
    colorScheme: 'light',
  })
})

test('diffThemeSelectionFromInput: loaded ThemeLike inputs seed by theme.name and resolve to names', () => {
  expect(
    diffThemeSelectionFromInput({light: loadedLightTheme, dark: loadedDarkTheme}, 'dark'),
  ).toEqual({
    lightThemeName: 'loaded-light-test',
    darkThemeName: 'loaded-dark-test',
    colorScheme: 'dark',
  })
})

test('DiffThemeInput: diff override types require names on ThemeLike object inputs', () => {
  // acceptDiffThemeInput returns void; the runtime assertions confirm these
  // accepted shapes are actually callable, alongside the @ts-expect-error
  // compile-time checks below for the rejected shapes.
  expect(acceptDiffThemeInput({name: 'named-object', type: 'dark'})).toBeUndefined()
  expect(
    acceptDiffThemeInput({
      light: {name: 'named-light-object', type: 'light'},
      dark: 'named-dark-theme',
    }),
  ).toBeUndefined()

  // @ts-expect-error Diff surfaces pass names to the worker/highlighter, so
  // object overrides must expose the name used to register the theme.
  acceptDiffThemeInput({type: 'dark', colors: {}})

  acceptDiffThemeInput({
    // @ts-expect-error Pair object slots have the same name requirement.
    light: {type: 'light', colors: {}},
    dark: {name: 'named-dark-object', type: 'dark'},
  })
})

test('diffThemeSelectionFromInput: nameless ThemeLike inputs still fail with a clear runtime error', () => {
  expect(() =>
    diffThemeSelectionFromInput({type: 'dark', colors: {}} as DiffThemeInput, 'dark'),
  ).toThrow('ThemeInput ThemeLike values used by diff wrappers')
})
