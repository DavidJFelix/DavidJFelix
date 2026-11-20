import '@testing-library/jest-dom/vitest'
import {act, fireEvent, render, within} from '@testing-library/react'
import {Profiler, type ProfilerOnRenderCallback} from 'react'
import {expect, test, vi} from 'vitest'

import {DiffUrlForm} from './diff-url-form'

const navigate = vi.hoisted(() => vi.fn<(options: unknown) => Promise<void>>())
vi.mock('@tanstack/react-router', () => ({useNavigate: () => navigate}))

test('the URL field has a name', () => {
  const view = render(<DiffUrlForm />)

  expect(within(view.container).getByRole('textbox', {name: 'Diff URL'})).toBeInTheDocument()
})

test('a submit of a valid URL opens the viewer for it', () => {
  const view = render(<DiffUrlForm />)
  const form = within(view.container)
  fireEvent.change(form.getByRole('textbox', {name: 'Diff URL'}), {
    target: {value: 'https://codeberg.org/forgejo/forgejo/pulls/15078'},
  })

  fireEvent.click(form.getByLabelText('Fetch diff'))

  expect(navigate).toHaveBeenCalledWith({
    to: '/diffs/$',
    params: {_splat: 'forgejo/forgejo/pulls/15078'},
    search: {domain: 'codeberg.org'},
  })
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
