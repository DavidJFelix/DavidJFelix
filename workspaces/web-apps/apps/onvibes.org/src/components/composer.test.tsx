import {expect, test, vi} from 'vitest'
import {userEvent} from 'vitest/browser'
import {render} from 'vitest-browser-react'

import {Composer} from './composer'

async function renderComposer() {
  const onSend = vi.fn<(text: string) => void>()
  const screen = await render(<Composer onSend={onSend} />)
  const input = screen.getByRole('textbox', {name: 'Message'})
  const send = screen.getByRole('button', {name: 'Send message'})
  return {onSend, input, send}
}

test('send is disabled until the draft has non-whitespace text', async () => {
  // given
  const {input, send} = await renderComposer()
  await expect.element(send).toBeDisabled()

  // when
  await input.fill('   ')

  // then
  await expect.element(send).toBeDisabled()

  // when
  await input.fill('A pocket metronome')

  // then
  await expect.element(send).toBeEnabled()
})

test('clicking send submits the trimmed draft and clears the field', async () => {
  // given
  const {onSend, input, send} = await renderComposer()
  await input.fill('  A pocket metronome  ')

  // when
  await send.click()

  // then
  expect(onSend).toHaveBeenCalledExactlyOnceWith('A pocket metronome')
  await expect.element(input).toHaveValue('')
})

test('Enter sends and clears the draft', async () => {
  // given
  const {onSend, input} = await renderComposer()
  await input.fill('line one')

  // when
  await userEvent.keyboard('{Enter}')

  // then
  expect(onSend).toHaveBeenCalledExactlyOnceWith('line one')
  await expect.element(input).toHaveValue('')
})

test('Shift+Enter breaks the line without sending', async () => {
  // given
  const {onSend, input} = await renderComposer()
  await input.fill('line one')

  // when
  await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
  await userEvent.keyboard('line two')

  // then
  expect(onSend).not.toHaveBeenCalled()
  await expect.element(input).toHaveValue('line one\nline two')
})

test('Enter with an empty draft sends nothing', async () => {
  // given
  const {onSend, input} = await renderComposer()
  await input.click()

  // when
  await userEvent.keyboard('{Enter}')

  // then
  expect(onSend).not.toHaveBeenCalled()
})

test('the textarea grows with its content', async () => {
  // given
  const {input} = await renderComposer()
  const before = input.element().getBoundingClientRect().height

  // when
  await input.fill('one\ntwo\nthree\nfour')

  // then
  expect(input.element().getBoundingClientRect().height).toBeGreaterThan(before)
})

test('while busy the button stops instead of sending, and Enter waits', async () => {
  // given
  const onSend = vi.fn<(text: string) => void>()
  const onStop = vi.fn<() => void>()
  const screen = await render(<Composer onSend={onSend} busy onStop={onStop} />)
  const input = screen.getByRole('textbox', {name: 'Message'})
  await input.fill('one more thing')

  // when
  await userEvent.keyboard('{Enter}')

  // then
  expect(onSend).not.toHaveBeenCalled()
  await expect.element(input).toHaveValue('one more thing')
  expect(screen.container.querySelector('button[type=submit]')).toBeNull()

  // when
  await screen.getByRole('button', {name: 'Stop generating'}).click()

  // then
  expect(onStop).toHaveBeenCalledOnce()
})

test('the textarea is labelled, and the placeholder only shows the expected input', async () => {
  // given
  const {input} = await renderComposer()

  // then
  await expect.element(input).toHaveAccessibleName('Message')
  await expect.element(input).toHaveAttribute('placeholder', 'Describe the app you want to build')
})
