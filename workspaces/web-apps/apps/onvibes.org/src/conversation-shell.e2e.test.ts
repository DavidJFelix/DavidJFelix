import {expect, test} from '@playwright/test'
import {mockReply} from './e2e-support'

// Interaction contract of the sidebar + conversation shell, beyond the
// happy paths in index.e2e.test.ts: keyboard-only use, the composer's key
// bindings, the thread following a streamed reply, the small-screen drawer's
// every close path, and the dark and small-screen visual baselines. The chat
// endpoint is mocked (mockReply), so all of it is deterministic.

test('the shell is fully keyboard operable', async ({page}) => {
  // given: two conversations, the older one titled by its first message
  await mockReply(page, 'Done.')
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  await page.getByRole('textbox', {name: 'Message'}).fill('Trail map')
  await page.getByRole('button', {name: 'Send message'}).click()
  await expect(page.getByRole('main').getByText('Done.')).toBeVisible()
  await page.getByRole('button', {name: 'New conversation', exact: true}).click()
  await expect(sidebar.getByRole('button')).toHaveCount(2)
  // Anchor at the sidebar's first control and walk the rows from there.
  await page.getByRole('button', {name: 'New conversation', exact: true}).focus()

  // when
  await page.keyboard.press('Tab')
  await expect(sidebar.getByRole('button', {name: /New conversation/u})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sidebar.getByRole('button', {name: /Trail map/u})).toBeFocused()
  await page.keyboard.press('Enter')

  // then
  await expect(page.getByRole('heading', {level: 1, name: 'Trail map'})).toBeVisible()
  await expect(sidebar.getByRole('button', {name: /Trail map/u})).toHaveAttribute(
    'aria-current',
    'true',
  )
})

test('Shift+Enter breaks the line without sending', async ({page}) => {
  // given
  await mockReply(page, 'Two lines received.')
  await page.goto('/')
  const input = page.getByRole('textbox', {name: 'Message'})
  const bubbles = page.getByRole('main').locator('[data-role]')
  await expect(bubbles).toHaveCount(0)

  // when
  await input.fill('first line')
  await input.press('Shift+Enter')
  await input.pressSequentially('second line')

  // then
  await expect(input).toHaveValue('first line\nsecond line')
  await expect(bubbles).toHaveCount(0)

  // when
  await input.press('Enter')

  // then
  await expect(bubbles).toHaveCount(2)
  await expect(bubbles.first()).toHaveText(/first line\s+second line/u)
  await expect(bubbles.last()).toHaveText('Two lines received.')
  await expect(input).toHaveValue('')
})

test('the thread follows a reply to its end as it streams', async ({page}) => {
  // given: a short frame and a reply taller than it
  await page.setViewportSize({width: 1280, height: 480})
  const lines = Array.from({length: 24}, (_, i) => `Line ${i + 1} of the plan.`)
  await mockReply(page, lines.join('\n'))
  await page.goto('/')
  const main = page.getByRole('main')

  // when
  await page.getByRole('textbox', {name: 'Message'}).fill('Plan the whole app')
  await page.getByRole('button', {name: 'Send message'}).click()

  // then
  await expect(main.getByText('Line 24 of the plan.')).toBeInViewport()
})

test('sending keeps the composer focused for the next message', async ({page}) => {
  // given
  await mockReply(page, 'Done.')
  await page.goto('/')
  const input = page.getByRole('textbox', {name: 'Message'})
  await input.fill('one')

  // when
  await input.press('Enter')

  // then
  await expect(input).toBeFocused()
})

test('the drawer closes on Escape and on the scrim', async ({page}) => {
  // given
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  const open = page.getByRole('button', {name: 'Open sidebar'})
  await open.click()
  await expect(sidebar).toBeInViewport()

  // when
  await page.keyboard.press('Escape')

  // then
  await expect(sidebar).not.toBeInViewport()

  // given
  await open.click()
  await expect(sidebar).toBeInViewport()

  // when: the scrim covers the main view, so a tap beside the drawer lands on it
  await page.mouse.click(350, 500)

  // then
  await expect(sidebar).not.toBeInViewport()
})

test('the drawer close button lives only in the small-screen layout', async ({page}) => {
  // given
  await page.goto('/')
  const close = page.getByRole('navigation', {name: 'Conversations'}).locator('..')

  // then
  await expect(close.getByRole('button', {name: 'Close sidebar'})).toBeHidden()

  // when
  await page.setViewportSize({width: 390, height: 844})
  await page.getByRole('button', {name: 'Open sidebar'}).click()

  // then
  await expect(close.getByRole('button', {name: 'Close sidebar'})).toBeVisible()
})

test('dark mode matches the visual baseline', async ({page}) => {
  // given
  await page.emulateMedia({colorScheme: 'dark'})
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  // then
  await expect(page).toHaveScreenshot('shell-dark.png', {maxDiffPixelRatio: 0.01})
})

test('the small-screen drawer matches the visual baseline', async ({page}) => {
  // given
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')

  // when
  await page.getByRole('button', {name: 'Open sidebar'}).click()
  await expect(page.getByRole('navigation', {name: 'Conversations'})).toBeInViewport()
  await page.evaluate(() => document.fonts.ready)

  // then
  await expect(page).toHaveScreenshot('shell-drawer.png', {maxDiffPixelRatio: 0.01})
})
