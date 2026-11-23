import {expect, test} from 'vitest'

import {formatRelativeTime} from './relative-time'

const NOW = Date.parse('2026-11-18T12:00:00Z')
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function before(milliseconds: number): Date {
  return new Date(NOW - milliseconds)
}

test.each([
  {name: 'the same moment', time: before(0), text: 'now'},
  {name: 'seconds', time: before(45 * SECOND), text: '45 seconds ago'},
  {name: 'one minute', time: before(MINUTE), text: '1 minute ago'},
  {name: 'minutes, rounded down', time: before(59 * MINUTE + 59 * SECOND), text: '59 minutes ago'},
  {name: 'hours', time: before(3 * HOUR + 20 * MINUTE), text: '3 hours ago'},
  {name: 'one day', time: before(DAY), text: 'yesterday'},
  {name: 'days', time: before(29 * DAY), text: '29 days ago'},
  {name: 'one month', time: before(30 * DAY), text: 'last month'},
  {name: 'months', time: before(200 * DAY), text: '6 months ago'},
  {name: 'years', time: before(800 * DAY), text: '2 years ago'},
  {name: 'a time in the future', time: before(-5 * MINUTE), text: 'now'},
])('$name reads as "$text"', ({time, text}) => {
  expect(formatRelativeTime({time, now: NOW, locale: 'en-US'})).toBe(text)
})

test.each([
  {name: 'a missing time', time: undefined},
  {name: 'a date that is not a time', time: new Date('last week')},
])('$name has no text', ({time}) => {
  expect(formatRelativeTime({time, now: NOW, locale: 'en-US'})).toBeUndefined()
})
