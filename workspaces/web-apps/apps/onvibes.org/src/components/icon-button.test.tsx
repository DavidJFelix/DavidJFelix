import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {expect, test, vi} from 'vitest'

import {IconButton, type IconButtonProps} from './icon-button'

function renderIconButton(props: Omit<IconButtonProps, 'children'>) {
  cleanup()
  render(
    <IconButton {...props}>
      <svg aria-hidden="true" />
    </IconButton>,
  )
  return screen.getByRole('button', {name: props.label})
}

test('the label is the accessible name and the title', () => {
  const button = renderIconButton({label: 'Open sidebar'})

  expect(button.getAttribute('title')).toBe('Open sidebar')
  expect(button.getAttribute('type')).toBe('button')
})

test('the submit variant is a real submit button', () => {
  const button = renderIconButton({label: 'Send message', type: 'submit'})
  expect(button.getAttribute('type')).toBe('submit')
})

test('clicks reach the handler', () => {
  const onClick = vi.fn<() => void>()
  const button = renderIconButton({label: 'Go', onClick})

  fireEvent.click(button)

  expect(onClick).toHaveBeenCalledOnce()
})

test('a disabled button swallows clicks', () => {
  const onClick = vi.fn<() => void>()
  const button = renderIconButton({label: 'Go', onClick, disabled: true})

  fireEvent.click(button)

  expect(onClick).not.toHaveBeenCalled()
})

test('a custom className is merged in', () => {
  const button = renderIconButton({label: 'Go', className: 'marker'})
  expect(button.className).toContain('marker')
})
