import {expect, test} from 'vitest'
import {render} from 'vitest-browser-svelte'
import ThemeToggle from './theme-toggle.svelte'

// Renders in real Chromium (vitest.config.ts, browser project): mode-watcher's
// preference state is a persisted store, so the cycle is proven against the
// browser's own localStorage rather than a mock of it.

test('the toggle cycles light, dark, then back to system, one press at a time', async () => {
  // given
  localStorage.clear()
  const screen = await render(ThemeToggle)
  const toggle = screen.getByRole('button')
  await expect.element(toggle).toHaveAccessibleName('Switch to light theme')

  // when
  await toggle.click()

  // then
  await expect.element(toggle).toHaveAccessibleName('Switch to dark theme')

  // when
  await toggle.click()

  // then
  await expect.element(toggle).toHaveAccessibleName('Switch to system theme')

  // when
  await toggle.click()

  // then
  await expect.element(toggle).toHaveAccessibleName('Switch to light theme')
})
