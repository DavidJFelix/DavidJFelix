import {expect, test} from '@playwright/test'

// onvibes.org renders a sidebar of conversations beside the selected
// conversation, from fixture data (no backend yet), so the visual baseline is
// stable. These run against a local production boot (baseline authoring) or a
// deployed preview URL (CI) -- see playwright.config.ts.

test('home page renders the sidebar and the first conversation', async ({page}) => {
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  await expect(sidebar.getByRole('button')).toHaveCount(5)
  await expect(sidebar.getByRole('button', {name: /Trail map for Starved Rock/u})).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(
    page.getByRole('heading', {level: 1, name: 'Trail map for Starved Rock'}),
  ).toBeVisible()
  await expect(
    page.getByRole('main').getByText('Can the pins cluster when zoomed out?'),
  ).toBeVisible()
})

test('selecting a conversation swaps the main view', async ({page}) => {
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})

  await sidebar.getByRole('button', {name: /Recipe scaler/u}).click()

  await expect(page.getByRole('heading', {level: 1, name: 'Recipe scaler'})).toBeVisible()
  await expect(page.getByRole('main').getByText('Add a toggle for metric.')).toBeVisible()
  await expect(sidebar.getByRole('button', {name: /Recipe scaler/u})).toHaveAttribute(
    'aria-current',
    'true',
  )
})

test('sending a message appends it to the conversation', async ({page}) => {
  await page.goto('/')
  const input = page.getByRole('textbox', {name: 'Message'})
  const send = page.getByRole('button', {name: 'Send message'})

  await expect(send).toBeDisabled()
  await input.fill('Can it export the map as a PDF?')
  await expect(send).toBeEnabled()
  await input.press('Enter')

  await expect(page.getByRole('main').getByText('Can it export the map as a PDF?')).toBeVisible()
  await expect(input).toHaveValue('')
  await expect(send).toBeDisabled()
})

test('a new conversation starts empty and takes its title from the first message', async ({
  page,
}) => {
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})

  await page.getByRole('button', {name: 'New conversation'}).click()

  await expect(page.getByRole('heading', {level: 1, name: 'New conversation'})).toBeVisible()
  await expect(page.getByText('What do you want to build?')).toBeVisible()
  await expect(sidebar.getByRole('button')).toHaveCount(6)

  await page.getByRole('textbox', {name: 'Message'}).fill('A pocket metronome')
  await page.getByRole('button', {name: 'Send message'}).click()

  await expect(page.getByRole('heading', {level: 1, name: 'A pocket metronome'})).toBeVisible()
  await expect(sidebar.getByRole('button', {name: /A pocket metronome/u})).toHaveAttribute(
    'aria-current',
    'true',
  )
})

test('the sidebar becomes a drawer on small screens', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844})
  await page.goto('/')
  const sidebar = page.getByRole('navigation', {name: 'Conversations'})
  await expect(sidebar).not.toBeInViewport()

  await page.getByRole('button', {name: 'Open sidebar'}).click()
  await expect(sidebar).toBeInViewport()

  await sidebar.getByRole('button', {name: /Pomodoro timer/u}).click()
  await expect(page.getByRole('heading', {level: 1, name: /Pomodoro timer/u})).toBeVisible()
  await expect(sidebar).not.toBeInViewport()
})

test('home page matches the visual baseline', async ({page}) => {
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('home.png', {maxDiffPixelRatio: 0.01})
})
