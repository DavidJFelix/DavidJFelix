import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {expect, test, vi} from 'vitest'

import {Composer} from './composer'

// Without vitest globals, Testing Library does not unmount between tests on
// its own; each helper starts from an empty document instead of a hook.
function renderComposer() {
  cleanup()
  const onSend = vi.fn<(text: string) => void>()
  render(<Composer onSend={onSend} />)
  const input = screen.getByRole('textbox', {name: 'Message'})
  const send = screen.getByRole('button', {name: 'Send message'})
  return {onSend, input, send}
}

test('send is disabled until the draft has non-whitespace text', () => {
  const {input, send} = renderComposer()
  expect(send).toHaveProperty('disabled', true)

  fireEvent.change(input, {target: {value: '   '}})
  expect(send).toHaveProperty('disabled', true)

  fireEvent.change(input, {target: {value: 'A pocket metronome'}})
  expect(send).toHaveProperty('disabled', false)
})

test('clicking send submits the trimmed draft and clears the field', () => {
  const {onSend, input, send} = renderComposer()
  fireEvent.change(input, {target: {value: '  A pocket metronome  '}})

  fireEvent.click(send)

  expect(onSend).toHaveBeenCalledExactlyOnceWith('A pocket metronome')
  expect(input).toHaveProperty('value', '')
})

test('Enter sends, Shift+Enter keeps composing', () => {
  const {onSend, input} = renderComposer()
  fireEvent.change(input, {target: {value: 'line one'}})

  fireEvent.keyDown(input, {key: 'Enter', shiftKey: true})
  expect(onSend).not.toHaveBeenCalled()
  expect(input).toHaveProperty('value', 'line one')

  fireEvent.keyDown(input, {key: 'Enter'})
  expect(onSend).toHaveBeenCalledExactlyOnceWith('line one')
  expect(input).toHaveProperty('value', '')
})

test('Enter with an empty draft sends nothing', () => {
  const {onSend, input} = renderComposer()

  fireEvent.keyDown(input, {key: 'Enter'})

  expect(onSend).not.toHaveBeenCalled()
})

test('the textarea has a visible-to-assistive-tech label, not just a placeholder', () => {
  const {input} = renderComposer()
  expect(input).toHaveProperty('placeholder', 'Describe the app you want to build')
  expect(screen.getByText('Message').tagName).toBe('LABEL')
})
