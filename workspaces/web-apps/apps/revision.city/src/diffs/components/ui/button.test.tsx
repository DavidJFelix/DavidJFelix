// @vitest-environment jsdom

import {act, type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test} from 'vitest'

import {Button} from './button'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

function render(element: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    createRoot(container).render(element)
  })
  return container
}

test('a button renders a button element with the variant classes', () => {
  const container = render(<Button variant="ghost">Save</Button>)
  const button = container.firstElementChild

  expect(button?.tagName).toBe('BUTTON')
  expect(button?.getAttribute('data-slot')).toBe('button')
  expect(button?.className).not.toBe('')
})

test('asChild puts the button props and classes on the child element', () => {
  const container = render(
    <Button asChild variant="ghost" className="extra" aria-label="Open">
      <a href="https://example.com/">Open</a>
    </Button>,
  )
  const link = container.firstElementChild

  expect(link?.tagName).toBe('A')
  expect(link?.getAttribute('href')).toBe('https://example.com/')
  expect(link?.getAttribute('aria-label')).toBe('Open')
  expect(link?.getAttribute('data-slot')).toBe('button')
  expect(link?.classList.contains('extra')).toBe(true)
  expect(container.querySelector('button')).toBeNull()
})
