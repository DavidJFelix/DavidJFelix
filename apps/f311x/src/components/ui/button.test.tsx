import {render, screen} from '@testing-library/react'
import {expect, test} from 'vitest'
import {Button} from './button'

test('Button renders its label as a native button', () => {
  render(<Button>Send</Button>)
  expect(screen.getByRole('button', {name: 'Send'})).toBeDefined()
})

test('Button merges a custom className onto the variant classes', () => {
  render(<Button className="test-marker">Go</Button>)
  expect(screen.getByRole('button', {name: 'Go'}).className).toContain('test-marker')
})
