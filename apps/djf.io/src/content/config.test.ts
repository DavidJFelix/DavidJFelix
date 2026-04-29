import {z} from 'astro:content'
import {expect, test} from 'vitest'
import {collections} from './config'

const schema = collections.blog.schema({image: () => z.any()})

test('blog schema accepts minimal valid frontmatter', () => {
  const result = schema.safeParse({
    title: 'Hello',
    description: 'world',
    date: new Date('2025-01-01'),
  })
  expect(result.success).toBe(true)
})

test('blog schema coerces ISO date strings to Date', () => {
  const result = schema.safeParse({
    title: 'x',
    description: 'y',
    date: '2025-12-07',
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.date).toBeInstanceOf(Date)
    expect(result.data.date.getUTCFullYear()).toBe(2025)
  }
})

test('blog schema rejects missing title', () => {
  const result = schema.safeParse({description: 'no title', date: new Date()})
  expect(result.success).toBe(false)
})

test('blog schema rejects missing description', () => {
  const result = schema.safeParse({title: 'no description', date: new Date()})
  expect(result.success).toBe(false)
})

test('blog schema rejects missing date', () => {
  const result = schema.safeParse({title: 'no date', description: 'x'})
  expect(result.success).toBe(false)
})

test('blog schema rejects unparseable date values', () => {
  const result = schema.safeParse({
    title: 'x',
    description: 'y',
    date: 'not-a-date',
  })
  expect(result.success).toBe(false)
})

test('blog schema accepts optional tags as an array of strings', () => {
  const result = schema.safeParse({
    title: 'x',
    description: 'y',
    date: new Date(),
    tags: ['running', 'meta-blog'],
  })
  expect(result.success).toBe(true)
})

test('blog schema accepts optional aiAssistants entries', () => {
  const result = schema.safeParse({
    title: 'x',
    description: 'y',
    date: new Date(),
    aiAssistants: [{name: 'Claude', details: 'editing'}, {name: 'Grammarly'}],
  })
  expect(result.success).toBe(true)
})

test('blog schema rejects aiAssistants entries missing required name', () => {
  const result = schema.safeParse({
    title: 'x',
    description: 'y',
    date: new Date(),
    aiAssistants: [{details: 'no name'}],
  })
  expect(result.success).toBe(false)
})
