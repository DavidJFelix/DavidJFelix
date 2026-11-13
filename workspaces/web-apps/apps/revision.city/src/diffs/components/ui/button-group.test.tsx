import '@testing-library/jest-dom/vitest'
import {render, screen} from '@testing-library/react'
import {expect, test} from 'vitest'

import {ButtonGroup, ButtonGroupItem} from './button-group'

test('only the selected item reports a pressed state', () => {
  render(
    <ButtonGroup value="Comments">
      <ButtonGroupItem value="Files">Files</ButtonGroupItem>
      <ButtonGroupItem value="Comments">Comments</ButtonGroupItem>
    </ButtonGroup>,
  )

  expect(screen.getByRole('button', {name: 'Comments'})).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', {name: 'Files'})).toHaveAttribute('aria-pressed', 'false')
})
