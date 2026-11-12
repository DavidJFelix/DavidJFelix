// @vitest-environment jsdom

import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test, vi} from 'vitest'

import {Switch} from './switch'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

function renderSwitch(checked: boolean) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const onCheckedChange = vi.fn<(checked: boolean) => void>()
  act(() => {
    createRoot(container).render(
      <Switch checked={checked} onCheckedChange={onCheckedChange}>
        Word wrap
      </Switch>,
    )
  })
  const input = container.querySelector('input')
  if (input === null) {
    throw new Error('the switch rendered no input')
  }
  return {container, input, onCheckedChange}
}

test('a click on the label reports the opposite state', async () => {
  const {container, onCheckedChange} = renderSwitch(false)
  const label = container.querySelector('label')

  await act(async () => {
    label?.click()
  })

  expect(onCheckedChange).toHaveBeenCalledWith(true)
})

test('the input is a named switch that shows the checked state', () => {
  const {container, input} = renderSwitch(true)

  expect(input.checked).toBe(true)
  expect(input.labels?.[0]?.textContent).toBe('Word wrap')
  expect(container.querySelector('[data-part="control"]')?.getAttribute('data-state')).toBe(
    'checked',
  )
})
