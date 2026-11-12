// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import type {DiffLineAnnotation} from '@pierre/diffs'
import {render, screen} from '@testing-library/react'
import {expect, test} from 'vitest'

import type {SavedCommentMetadata} from '@/diffs/lib/types'
import {ExampleAnnotation} from './example-annotation'

const annotation: DiffLineAnnotation<SavedCommentMetadata> = {
  side: 'additions',
  lineNumber: 1,
  metadata: {
    kind: 'saved',
    key: 'comment-1',
    author: 'Ada',
    message: 'Check the bounds here.',
    range: {start: 1, end: 1},
  },
}

test('a saved comment is named by its author and message', () => {
  render(
    <ExampleAnnotation
      annotation={annotation}
      itemId="file-1"
      onDelete={() => {}}
      onToggleSelection={() => {}}
    />,
  )

  expect(screen.getByRole('button', {name: /Ada.*Check the bounds here\./})).toBeInTheDocument()
})
