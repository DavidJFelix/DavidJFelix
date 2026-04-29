import {z} from 'astro:content'
import {describe, expect, test} from 'vitest'
import {collections} from './config'

const schema = collections.blog.schema({image: () => z.any()})

describe('blog content schema', () => {
  test('accepts minimal valid frontmatter', () => {
    const result = schema.safeParse({
      title: 'Hello',
      description: 'world',
      date: new Date('2025-01-01'),
    })
    expect(result.success).toBe(true)
  })

  test('coerces ISO date strings to Date', () => {
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

  test('rejects missing required fields', () => {
    expect(schema.safeParse({description: 'no title', date: new Date()}).success).toBe(false)
    expect(schema.safeParse({title: 'no description', date: new Date()}).success).toBe(false)
    expect(schema.safeParse({title: 'no date', description: 'x'}).success).toBe(false)
  })

  test('rejects unparseable date values', () => {
    const result = schema.safeParse({
      title: 'x',
      description: 'y',
      date: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  test('accepts optional tags as an array of strings', () => {
    const result = schema.safeParse({
      title: 'x',
      description: 'y',
      date: new Date(),
      tags: ['running', 'meta-blog'],
    })
    expect(result.success).toBe(true)
  })

  test('accepts optional aiAssistants entries', () => {
    const result = schema.safeParse({
      title: 'x',
      description: 'y',
      date: new Date(),
      aiAssistants: [{name: 'Claude', details: 'editing'}, {name: 'Grammarly'}],
    })
    expect(result.success).toBe(true)
  })

  test('rejects aiAssistants entries missing required name', () => {
    const result = schema.safeParse({
      title: 'x',
      description: 'y',
      date: new Date(),
      aiAssistants: [{details: 'no name'}],
    })
    expect(result.success).toBe(false)
  })
})
