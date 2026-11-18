import {expect, test} from 'vitest'

import {baseMovedOnText} from './base-moved-on-text'

test.each([
  {range: 'main...feature', behindBy: 3, text: 'main moved on 3 commits since the merge base'},
  {range: 'main...feature', behindBy: 1, text: 'main moved on 1 commit since the merge base'},
  {range: 'feature', behindBy: 2, text: 'The base branch moved on 2 commits since the merge base'},
  {
    range: '...feature',
    behindBy: 2,
    text: 'The base branch moved on 2 commits since the merge base',
  },
])('$range behind by $behindBy reads "$text"', ({range, behindBy, text}) => {
  expect(baseMovedOnText({range, behindBy})).toBe(text)
})
