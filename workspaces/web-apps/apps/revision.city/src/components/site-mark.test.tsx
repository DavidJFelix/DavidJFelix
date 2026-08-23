import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect, test} from 'vitest'
import faviconSvg from '../../public/favicon.svg?raw'
import {SiteMark} from './site-mark'

// React's act() only suppresses its "not wrapped in act" warning when this
// flag is set; jsdom doesn't set it for us.
;(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

function renderMark(): SVGSVGElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<SiteMark />)
  })
  const svg = container.querySelector('svg')
  if (svg === null) throw new Error('SiteMark rendered no svg')
  return svg
}

// The mark exists in two copies that no build step ties together: this one
// imports `building-2` from lucide-react, while public/favicon.svg carries the
// paths copied out of the same package by hand. A lucide upgrade that redraws
// the glyph would silently move only the imported half, leaving the tab showing
// one building and the header another -- which is exactly what the favicon's
// own "re-copy if the drawing changes" note is asking someone to remember.
// Assert it instead.
test('site mark draws the same glyph the favicon does', () => {
  const rendered = [...renderMark().querySelectorAll('path')].map((path) => path.getAttribute('d'))

  expect(rendered).toHaveLength(5)
  for (const d of rendered) {
    expect(faviconSvg).toContain(`d="${d}"`)
  }
})

// Sized in em and left uncolored on purpose -- both are what let the same
// component sit in the landing header, the diffs heading, and the themed diffs
// chrome without any of the three passing sizing or color props.
test('site mark takes its size and color from the text beside it', () => {
  const svg = renderMark()

  expect(svg.getAttribute('width')).toBe('1em')
  expect(svg.getAttribute('height')).toBe('1em')
  expect(svg.getAttribute('stroke')).toBe('currentColor')
})

// Every placement pairs the mark with the site or section name in text, so the
// glyph itself must stay out of the accessibility tree rather than announcing a
// second, redundant name.
test('site mark is decorative', () => {
  expect(renderMark().getAttribute('aria-hidden')).toBe('true')
})
