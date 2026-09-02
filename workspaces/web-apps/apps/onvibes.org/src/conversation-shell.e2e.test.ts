import {expect, test} from '@playwright/test'

// Interaction contract of the sidebar + conversation shell, beyond the
// happy paths in index.e2e.test.ts: keyboard-only use, the composer's key
// bindings, the small-screen drawer's every close path, and the dark and
// small-screen visual baselines. Fixture-backed, so all of it is deterministic.

test('the shell is fully keyboard operable', async ({page}) => {
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})

  // Chromium starts sequential focus at the last message scrolled into view,
  // so anchor at the sidebar's first control and walk the rows from there.
  await page.getByRole('button', {name: 'New conversation'}).focus()
  await page.keyboard.press('Tab')
  await expect(sidebar.getByRole('button', {name: /Trail map/u})).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', {level: 1, name: /Pomodoro timer/u})).toBeVisible()
  await expect(sidebar.getByRole('button', {name: /Pomodoro timer/u})).toHaveAttribute(
    'aria-current',
    'true',
  )
})

test('Shift+Enter breaks the line without sending', async ({page}) => {
  await page.goto('/')
  const input = page.getByRole('textbox', {name: 'Message'})
  const bubbles = page.getByRole('main').locator('[data-role]')
  await expect(bubbles).toHaveCount(4)

  await input.fill('first line')
  await input.press('Shift+Enter')
  await input.pressSequentially('second line')

  await expect(input).toHaveValue('first line\nsecond line')
  await expect(bubbles).toHaveCount(4)

  await input.press('Enter')

  await expect(bubbles).toHaveCount(5)
  await expect(bubbles.last()).toHaveText(/first line\s+second line/u)
  await expect(input).toHaveValue('')
})

test('a sent message scrolls into view at the bottom of the thread', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 480})
  await page.goto('/')
  const main = page.getByRole('main')
  const last = main.getByText('clustering to a short pure function')
  await expect(last).toBeInViewport()

  await page.getByRole('textbox', {name: 'Message'}).fill('And a legend for the pins')
  await page.getByRole('button', {name: 'Send message'}).click()

  await expect(main.getByText('And a legend for the pins')).toBeInViewport()
})

test('sending keeps the composer focused for the next message', async ({page}) => {
  await page.goto('/')
  const input = page.getByRole('textbox', {name: 'Message'})

  await input.fill('one')
  await input.press('Enter')

  await expect(input).toBeFocused()
})

test('the drawer closes on Escape and on the scrim', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  const open = page.getByRole('button', {name: 'Open sidebar'})

  await open.click()
  await expect(sidebar).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(sidebar).not.toBeInViewport()

  await open.click()
  await expect(sidebar).toBeInViewport()
  // The scrim covers the main view; a tap beside the drawer lands on it.
  await page.mouse.click(350, 500)
  await expect(sidebar).not.toBeInViewport()
})

test('the drawer close button lives only in the small-screen layout', async ({page}) => {
  await page.goto('/')
  const close = page.getByRole('navigation', {name: 'Conversations'}).locator('..')
  await expect(close.getByRole('button', {name: 'Close sidebar'})).toBeHidden()

  await page.setViewportSize({width: 390, height: 844})
  await page.getByRole('button', {name: 'Open sidebar'}).click()
  await expect(close.getByRole('button', {name: 'Close sidebar'})).toBeVisible()
})

test('dark mode matches the visual baseline', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('shell-dark.png', {maxDiffPixelRatio: 0.01})
})

test('the small-screen drawer matches the visual baseline', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  await page.getByRole('button', {name: 'Open sidebar'}).click()
  await expect(page.getByRole('navigation', {name: 'Conversations'})).toBeInViewport()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('shell-drawer.png', {maxDiffPixelRatio: 0.01})
})
