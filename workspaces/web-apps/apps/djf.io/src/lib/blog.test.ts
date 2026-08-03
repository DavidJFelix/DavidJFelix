import {expect, test} from 'vitest'
import {
  collectTags,
  formatBlogDate,
  postNeighbors,
  postsForTag,
  sortPostsByDateDesc,
  tagCountsDesc,
} from './blog'

const post = (date: string, tags?: Array<string>) => ({
  data: {date: new Date(date), ...(tags === undefined ? {} : {tags})},
})

const idPost = (id: string, date: string) => ({id, data: {date: new Date(date)}})

test('sortPostsByDateDesc orders posts newest first', () => {
  const a = post('2025-01-01')
  const b = post('2025-06-01')
  const c = post('2024-12-31')
  expect(sortPostsByDateDesc([a, b, c])).toEqual([b, a, c])
})

test('sortPostsByDateDesc does not mutate the input array', () => {
  const input = [post('2025-01-01'), post('2025-02-01')]
  const snapshot = [...input]
  sortPostsByDateDesc(input)
  expect(input).toEqual(snapshot)
})

test('sortPostsByDateDesc returns an empty array unchanged', () => {
  expect(sortPostsByDateDesc([])).toEqual([])
})

test('collectTags returns each distinct tag once, in first-seen order', () => {
  const posts = [post('2025-01-01', ['running', 'meta']), post('2025-02-01', ['meta', 'life'])]
  expect(collectTags(posts)).toEqual(['running', 'meta', 'life'])
})

test('collectTags skips posts without tags', () => {
  expect(collectTags([post('2025-01-01'), post('2025-02-01', ['running'])])).toEqual(['running'])
})

test('tagCountsDesc counts tag usage, most-used first', () => {
  const posts = [
    post('2025-01-01', ['running', 'meta']),
    post('2025-02-01', ['meta']),
    post('2025-03-01', ['meta', 'running']),
  ]
  expect(tagCountsDesc(posts)).toEqual([
    ['meta', 3],
    ['running', 2],
  ])
})

test('tagCountsDesc is empty when no post has tags', () => {
  expect(tagCountsDesc([post('2025-01-01'), post('2025-02-01')])).toEqual([])
})

test('postsForTag returns only matching posts, newest first', () => {
  const a = post('2025-01-01', ['running'])
  const b = post('2025-06-01', ['running', 'meta'])
  const c = post('2025-03-01', ['life'])
  expect(postsForTag([a, b, c], 'running')).toEqual([b, a])
})

test('postsForTag returns an empty array when no post carries the tag', () => {
  expect(postsForTag([post('2025-01-01', ['running'])], 'absent')).toEqual([])
})

test('postNeighbors finds both neighbors for a middle post', () => {
  const newest = idPost('newest', '2025-06-01')
  const middle = idPost('middle', '2025-03-01')
  const oldest = idPost('oldest', '2025-01-01')
  expect(postNeighbors([oldest, newest, middle], 'middle')).toEqual({prev: oldest, next: newest})
})

test('postNeighbors gives the newest post only an older neighbor', () => {
  const newest = idPost('newest', '2025-06-01')
  const oldest = idPost('oldest', '2025-01-01')
  expect(postNeighbors([newest, oldest], 'newest')).toEqual({prev: oldest, next: undefined})
})

test('postNeighbors gives the oldest post only a newer neighbor', () => {
  const newest = idPost('newest', '2025-06-01')
  const oldest = idPost('oldest', '2025-01-01')
  expect(postNeighbors([newest, oldest], 'oldest')).toEqual({prev: undefined, next: newest})
})

test('postNeighbors returns nothing for an unknown id', () => {
  expect(postNeighbors([idPost('only', '2025-01-01')], 'absent')).toEqual({})
})

test('formatBlogDate renders a long-form en-US date', () => {
  expect(formatBlogDate(new Date(2025, 11, 7))).toBe('December 7, 2025')
})

test('formatBlogDate renders single-digit days without padding', () => {
  expect(formatBlogDate(new Date(2025, 4, 5))).toBe('May 5, 2025')
})
