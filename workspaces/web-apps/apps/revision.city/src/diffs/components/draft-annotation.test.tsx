import '@testing-library/jest-dom/vitest'
import type {DiffLineAnnotation} from '@pierre/diffs'
import {render, screen} from '@testing-library/react'
import {expect, test} from 'vitest'

import type {DraftCommentMetadata} from '@/diffs/lib/types'
import {DraftAnnotation} from './draft-annotation'

const annotation: DiffLineAnnotation<DraftCommentMetadata> = {
  side: 'additions',
  lineNumber: 1,
  metadata: {kind: 'draft', key: 'draft-1', message: '', range: {start: 1, end: 1}},
}

test('the comment box and both submit buttons have names', () => {
  render(
    <DraftAnnotation
      annotation={annotation}
      itemId="file-1"
      onCancel={() => {}}
      onSave={() => {}}
    />,
  )

  expect(screen.getByRole('textbox', {name: 'Comment'})).toBeInTheDocument()
  expect(screen.getAllByRole('button', {name: 'Submit'})).toHaveLength(2)
})
