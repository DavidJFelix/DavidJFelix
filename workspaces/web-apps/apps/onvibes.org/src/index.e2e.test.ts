import {expect, test} from '@playwright/test'
import {mockReply} from './e2e-support'

// onvibes.org opens on a fresh conversation beside a sidebar that fills in as
// conversations start. The chat endpoint is answered per test by Playwright
// with a canned AG-UI stream (mockReply in e2e-support.ts), so the suite is
// deterministic and needs no OpenRouter key whether it runs against a local
// production boot (baseline authoring) or a deployed preview URL (CI) -- see
// playwright.config.ts. One test hits the real route to prove it is deployed.

test('home page opens on a fresh conversation', async ({page}) => {
  // given
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})

  // when
  await page.goto('/')

  // then
  await expect(sidebar.getByRole('button')).toHaveCount(1)
  await expect(sidebar.getByRole('button', {name: /New conversation/u})).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(page.getByRole('heading', {level: 1, name: 'New conversation'})).toBeVisible()
  await expect(page.getByText('What do you want to build?')).toBeVisible()
})

test('sending a message streams the reply in and names the conversation', async ({page}) => {
  // given
  await mockReply(page, 'Fourteen pins, one card each.')
  await page.goto('/')
  const main = page.getByRole('main')
  const input = page.getByRole('textbox', {name: 'Message'})
  const send = page.getByRole('button', {name: 'Send message'})
  await expect(send).toBeDisabled()

  // when
  await input.fill('Map the canyons of Starved Rock')
  await expect(send).toBeEnabled()
  await input.press('Enter')

  // then
  const bubbles = main.locator('[data-role]')
  await expect(bubbles).toHaveCount(2)
  await expect(bubbles.first()).toHaveText('Map the canyons of Starved Rock')
  await expect(bubbles.last()).toHaveText('Fourteen pins, one card each.')
  await expect(
    page.getByRole('heading', {level: 1, name: 'Map the canyons of Starved Rock'}),
  ).toBeVisible()
  const row = page.getByRole('navigation', {name: 'Conversations'}).getByRole('button')
  await expect(row).toHaveText(/Map the canyons of Starved Rock.*Fourteen pins, one card each\./u)
  await expect(input).toHaveValue('')
  await expect(send).toBeDisabled()
})

test('a new conversation starts empty and the old one keeps its thread', async ({page}) => {
  // given
  await mockReply(page, 'Done.')
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  const main = page.getByRole('main')
  await page.getByRole('textbox', {name: 'Message'}).fill('A pocket metronome')
  await page.getByRole('button', {name: 'Send message'}).click()
  await expect(main.getByText('Done.')).toBeVisible()

  // when
  await page.getByRole('button', {name: 'New conversation', exact: true}).click()

  // then
  await expect(page.getByRole('heading', {level: 1, name: 'New conversation'})).toBeVisible()
  await expect(page.getByText('What do you want to build?')).toBeVisible()
  await expect(sidebar.getByRole('button')).toHaveCount(2)
  await expect(sidebar.getByRole('button', {name: /New conversation/u})).toHaveAttribute(
    'aria-current',
    'true',
  )

  // when
  await sidebar.getByRole('button', {name: /A pocket metronome/u}).click()

  // then
  await expect(page.getByRole('heading', {level: 1, name: 'A pocket metronome'})).toBeVisible()
  const bubbles = main.locator('[data-role]')
  await expect(bubbles.first()).toHaveText('A pocket metronome')
  await expect(bubbles.last()).toHaveText('Done.')
})

test('a failed reply says so, and trying again asks once more', async ({page}) => {
  // given
  await page.route('**/api/chat', (route) =>
    route.fulfill({status: 503, body: 'Chat is not configured'}),
  )
  await page.goto('/')
  const main = page.getByRole('main')
  await page.getByRole('textbox', {name: 'Message'}).fill('Anyone there?')
  await page.getByRole('button', {name: 'Send message'}).click()
  await expect(page.getByRole('alert')).toHaveText(/Chat is not set up on this server yet\./u)

  // when
  await mockReply(page, 'Here now.')
  await page.getByRole('button', {name: 'Try again'}).click()

  // then
  await expect(main.getByText('Here now.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the deployed chat route holds its contract', async ({request}) => {
  // when: a body outside the contract, so no key or model is involved
  const rejected = await request.post('/api/chat', {data: {messages: []}})

  // then
  expect(rejected.status()).toBe(400)
})

test('the sidebar becomes a drawer on small screens', async ({page}) => {
  // given
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  await expect(sidebar).not.toBeInViewport()

  // when
  await page.getByRole('button', {name: 'Open sidebar'}).click()

  // then
  await expect(sidebar).toBeInViewport()

  // when
  await page.getByRole('button', {name: 'New conversation', exact: true}).click()

  // then
  await expect(sidebar.getByRole('button')).toHaveCount(2)
  await expect(sidebar).not.toBeInViewport()
})

test('home page matches the visual baseline', async ({page}) => {
  // given
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)

  // then
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
