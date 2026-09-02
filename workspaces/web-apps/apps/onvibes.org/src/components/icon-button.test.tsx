import {expect, test, vi} from 'vitest'
import {render} from 'vitest-browser-react'

import {IconButton, type IconButtonProps} from './icon-button'

async function renderIconButton(props: Omit<IconButtonProps, 'children'>) {
  const screen = await render(
    <IconButton {...props}>
      <svg aria-hidden="true" />
    </IconButton>,
  )
  return screen.getByRole('button', {name: props.label})
}

test('the label is the accessible name and the title', async () => {
  // given
  const button = await renderIconButton({label: 'Open sidebar'})

  // then
  await expect.element(button).toHaveAccessibleName('Open sidebar')
  await expect.element(button).toHaveAttribute('title', 'Open sidebar')
  await expect.element(button).toHaveAttribute('type', 'button')
})

test('the submit variant is a real submit button', async () => {
  // given
  const button = await renderIconButton({label: 'Send message', type: 'submit'})

  // then
  await expect.element(button).toHaveAttribute('type', 'submit')
})

test('the hit area is at least 36px square', async () => {
  // given
  const button = await renderIconButton({label: 'Go'})

  // when
  const {width, height} = button.element().getBoundingClientRect()

  // then
  expect(width).toBeGreaterThanOrEqual(36)
  expect(height).toBeGreaterThanOrEqual(36)
})

test('clicks reach the handler', async () => {
  // given
  const onClick = vi.fn<() => void>()
  const button = await renderIconButton({label: 'Go', onClick})

  // when
  await button.click()

  // then
  expect(onClick).toHaveBeenCalledOnce()
})

test('a disabled button swallows clicks', async () => {
  // given
  const onClick = vi.fn<() => void>()
  const button = await renderIconButton({label: 'Go', onClick, disabled: true})

  // when
  await button.click({force: true})

  // then
  expect(onClick).not.toHaveBeenCalled()
  await expect.element(button).toBeDisabled()
})

test('a custom className is merged in', async () => {
  // given
  const button = await renderIconButton({label: 'Go', className: 'marker'})

  // then
  expect(button.element().className).toContain('marker')
})
