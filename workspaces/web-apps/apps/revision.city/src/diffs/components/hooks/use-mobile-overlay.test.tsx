import {cleanup, fireEvent, render} from '@testing-library/react'
import {useRef} from 'react'
import {expect, onTestFinished, test, vi} from 'vitest'

import {MOBILE_MEDIA_QUERY, useMobileOverlay} from './use-mobile-overlay'

function stubPhoneWidth(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({matches: matches && query === MOBILE_MEDIA_QUERY})),
  )
}

interface OverlayProps {
  open: boolean
  onClose: () => void
}

// A small copy of the review page: a toggle and a viewer that go inert while
// the overlay is open, and the panel that the hook controls.
function Overlay({open, onClose}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useMobileOverlay({open, onClose, panelRef, scrollRef})
  return (
    <>
      <button type="button" inert={open}>
        Toggle
      </button>
      <div data-testid="viewer" inert={open} ref={scrollRef} />
      <div data-testid="panel" ref={panelRef} tabIndex={-1} />
    </>
  )
}

function renderOverlay(props: OverlayProps) {
  const view = render(<Overlay {...props} />)
  onTestFinished(cleanup)
  return view
}

test('the viewer is inert only while the overlay is open', () => {
  stubPhoneWidth(true)
  const onClose = vi.fn<() => void>()
  const view = renderOverlay({open: false, onClose})
  expect(view.getByTestId('viewer').hasAttribute('inert')).toBe(false)

  view.rerender(<Overlay open onClose={onClose} />)
  expect(view.getByTestId('viewer').hasAttribute('inert')).toBe(true)

  view.rerender(<Overlay open={false} onClose={onClose} />)
  expect(view.getByTestId('viewer').hasAttribute('inert')).toBe(false)
})

test('opening moves focus into the panel', () => {
  stubPhoneWidth(true)
  const onClose = vi.fn<() => void>()
  const view = renderOverlay({open: false, onClose})
  view.getByRole('button', {name: 'Toggle'}).focus()

  view.rerender(<Overlay open onClose={onClose} />)

  expect(document.activeElement).toBe(view.getByTestId('panel'))
})

test('opening focuses the panel without a scroll, so the slide does not jump', () => {
  stubPhoneWidth(true)
  const onClose = vi.fn<() => void>()
  const view = renderOverlay({open: false, onClose})
  const focus = vi.spyOn(view.getByTestId('panel'), 'focus')

  view.rerender(<Overlay open onClose={onClose} />)

  expect(focus).toHaveBeenCalledWith({preventScroll: true})
})

test('Escape calls onClose, and closing puts focus back on the opener', () => {
  stubPhoneWidth(true)
  const onClose = vi.fn<() => void>()
  const view = renderOverlay({open: false, onClose})
  const toggle = view.getByRole('button', {name: 'Toggle'})
  toggle.focus()
  view.rerender(<Overlay open onClose={onClose} />)

  fireEvent.keyDown(document, {key: 'Escape'})
  expect(onClose).toHaveBeenCalledOnce()

  view.rerender(<Overlay open={false} onClose={onClose} />)
  expect(document.activeElement).toBe(toggle)
})

test('other keys do not close the overlay', () => {
  stubPhoneWidth(true)
  const onClose = vi.fn<() => void>()
  renderOverlay({open: true, onClose})

  fireEvent.keyDown(document, {key: 'Enter'})

  expect(onClose).not.toHaveBeenCalled()
})

test('opening locks the page and viewer scroll, and closing restores it', () => {
  stubPhoneWidth(true)
  const onClose = vi.fn<() => void>()
  document.body.style.overflow = 'auto'
  document.documentElement.style.overscrollBehavior = 'auto'
  onTestFinished(() => {
    document.body.style.overflow = ''
    document.documentElement.style.overscrollBehavior = ''
  })
  const view = renderOverlay({open: false, onClose})
  const viewer = view.getByTestId('viewer')
  viewer.style.overflow = 'scroll'

  view.rerender(<Overlay open onClose={onClose} />)
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.documentElement.style.overscrollBehavior).toBe('none')
  expect(viewer.style.overflow).toBe('hidden')

  view.rerender(<Overlay open={false} onClose={onClose} />)
  expect(document.body.style.overflow).toBe('auto')
  expect(document.documentElement.style.overscrollBehavior).toBe('auto')
  expect(viewer.style.overflow).toBe('scroll')
})

test('at desktop width the open flag does nothing', () => {
  stubPhoneWidth(false)
  const onClose = vi.fn<() => void>()
  const view = renderOverlay({open: false, onClose})
  view.getByRole('button', {name: 'Toggle'}).focus()

  view.rerender(<Overlay open onClose={onClose} />)
  fireEvent.keyDown(document, {key: 'Escape'})

  expect(document.body.style.overflow).toBe('')
  expect(document.activeElement).not.toBe(view.getByTestId('panel'))
  expect(onClose).not.toHaveBeenCalled()
})
