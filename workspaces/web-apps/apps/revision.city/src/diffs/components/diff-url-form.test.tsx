import '@testing-library/jest-dom/vitest'
import {act, fireEvent, render, within} from '@testing-library/react'
import {Profiler, type ProfilerOnRenderCallback} from 'react'
import {expect, test, vi} from 'vitest'

import {DiffUrlForm} from './diff-url-form'

vi.mock('@tanstack/react-router', () => ({useNavigate: () => vi.fn<() => Promise<void>>()}))

test('the URL field has a name', () => {
  const view = render(<DiffUrlForm />)

  expect(within(view.container).getByRole('textbox', {name: 'Diff URL'})).toBeInTheDocument()
})

test('scroll events do not render the form again while the input stays in place', () => {
  const onRender = vi.fn<ProfilerOnRenderCallback>()
  const view = render(
    <Profiler id="form" onRender={onRender}>
      <DiffUrlForm />
    </Profiler>,
  )
  const input = within(view.container).getByRole('textbox', {name: 'Diff URL'})
  fireEvent.change(input, {target: {value: 'not a url'}})
  fireEvent.submit(input)
  expect(view.getByText('Please enter a valid URL')).toBeInTheDocument()
  onRender.mockClear()

  for (let index = 0; index < 50; index++) {
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
  }

  expect(onRender.mock.calls.length).toBeLessThanOrEqual(1)
})
