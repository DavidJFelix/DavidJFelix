// @vitest-environment jsdom

import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test, vi} from 'vitest'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
// The menu positions itself with Floating UI, which watches sizes with a
// ResizeObserver that jsdom does not provide.
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(globalThis, {ResizeObserver: StubResizeObserver})

interface MenuHarnessOptions {
  onSelect?: () => void
  onCheckedChange?: (checked: boolean) => void
  onOpenChange?: (open: boolean) => void
}

async function openMenu({onSelect, onCheckedChange, onOpenChange}: MenuHarnessOptions) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <DropdownMenu align="end" onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Close me</DropdownMenuItem>
          <DropdownMenuItem closeOnSelect={false}>Keep open</DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={false}
            closeOnSelect={false}
            onCheckedChange={onCheckedChange}
          >
            Added
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
  })
  await act(async () => {
    container.querySelector('button')?.click()
  })
  // Unmounting stops the positioning loop, which otherwise outlives the test.
  return {
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function menuItem(name: string): HTMLElement {
  const item = [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    (element) => element.textContent === name,
  )
  if (item === undefined) {
    throw new Error(`no menu item named ${name}`)
  }
  return item
}

function menuIsOpen(): boolean {
  return document.querySelector('[role="menu"]')?.getAttribute('data-state') === 'open'
}

test('the trigger opens the menu and reports the open state', async () => {
  const onOpenChange = vi.fn<(open: boolean) => void>()
  const menu = await openMenu({onOpenChange})

  expect(menuIsOpen()).toBe(true)
  expect(onOpenChange).toHaveBeenCalledWith(true)
  menu.unmount()
})

test('a plain item runs onSelect and closes the menu', async () => {
  const onSelect = vi.fn<() => void>()
  const menu = await openMenu({onSelect})

  await act(async () => {
    menuItem('Close me').click()
  })

  expect(onSelect).toHaveBeenCalledOnce()
  expect(menuIsOpen()).toBe(false)
  menu.unmount()
})

test('an item with closeOnSelect false keeps the menu open', async () => {
  const menu = await openMenu({})

  await act(async () => {
    menuItem('Keep open').click()
  })

  expect(menuIsOpen()).toBe(true)
  menu.unmount()
})

test('a checkbox item reports the new checked state', async () => {
  const onCheckedChange = vi.fn<(checked: boolean) => void>()
  const menu = await openMenu({onCheckedChange})

  await act(async () => {
    menuItem('Added').click()
  })

  expect(onCheckedChange).toHaveBeenCalledWith(true)
  expect(menuIsOpen()).toBe(true)
  menu.unmount()
})
