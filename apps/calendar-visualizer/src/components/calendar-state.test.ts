import {expect, test} from 'vitest'
import {type GridDay, getCalendarDisplayState, type MonthState} from './calendar-state'

const year2025 = {start: new Date(2025, 0, 1), end: new Date(2025, 11, 31)}

function daySlots(month: MonthState): GridDay[] {
  return month.slottedDays.filter((slot): slot is GridDay => slot.type === 'day')
}

function dayOfMonth(month: MonthState, date: number): GridDay {
  const day = daySlots(month).find((slot) => slot.date.getDate() === date)
  if (day === undefined) throw new Error(`no day ${date} in ${month.monthName}`)
  return day
}

test('a full year produces twelve months in order', () => {
  const months = getCalendarDisplayState(year2025)
  expect(months.map((month) => month.monthName)).toEqual([
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ])
})

test('january 2025 pads three spacers before Wednesday the 1st', () => {
  const [january] = getCalendarDisplayState(year2025)
  expect(january.slottedDays.slice(0, 3).map((slot) => slot.type)).toEqual([
    'spacer',
    'spacer',
    'spacer',
  ])
  const fourth = january.slottedDays[3]
  expect(fourth.type).toBe('day')
  expect((fourth as GridDay).date.getDate()).toBe(1)
})

test('january 2025 contains all 31 days in order', () => {
  const [january] = getCalendarDisplayState(year2025)
  expect(daySlots(january).map((slot) => slot.date.getDate())).toEqual(
    Array.from({length: 31}, (_, i) => i + 1),
  )
})

test('slot indexes match their grid positions', () => {
  const [january] = getCalendarDisplayState(year2025)
  january.slottedDays.forEach((slot, position) => {
    expect(slot.index).toBe(position)
  })
})

test('saturdays and sundays are tagged with a weekend feature', () => {
  const [january] = getCalendarDisplayState(year2025)
  // 2025-01-04 is a Saturday, 2025-01-05 is a Sunday
  expect(dayOfMonth(january, 4).dayFeatures).toEqual([{type: 'weekend'}])
  expect(dayOfMonth(january, 5).dayFeatures).toEqual([{type: 'weekend'}])
})

test('ordinary weekdays have no features', () => {
  const [january] = getCalendarDisplayState(year2025)
  // 2025-01-02 is a plain Thursday
  expect(dayOfMonth(january, 2).dayFeatures).toEqual([])
})

test("new year's day is tagged as a holiday with its name", () => {
  const [january] = getCalendarDisplayState(year2025)
  const features = dayOfMonth(january, 1).dayFeatures
  expect(features).toContainEqual({type: 'holiday', name: expect.stringContaining('New Year')})
})

test('christmas is tagged as a holiday', () => {
  const months = getCalendarDisplayState(year2025)
  const december = months[11]
  expect(dayOfMonth(december, 25).dayFeatures).toContainEqual({
    type: 'holiday',
    name: expect.stringContaining('Christmas'),
  })
})

test('an interval starting mid-month begins at that day with weekday padding', () => {
  // 2025-02-15 is a Saturday (column 6)
  const months = getCalendarDisplayState({
    start: new Date(2025, 1, 15),
    end: new Date(2025, 2, 10),
  })
  expect(months).toHaveLength(2)
  const [february] = months
  expect(february.monthName).toBe('February')
  expect(february.slottedDays.slice(0, 6).every((slot) => slot.type === 'spacer')).toBe(true)
  expect(daySlots(february)[0].date.getDate()).toBe(15)
})

test('an interval ending mid-month stops at the end date', () => {
  const months = getCalendarDisplayState({
    start: new Date(2025, 1, 15),
    end: new Date(2025, 2, 10),
  })
  const march = months[1]
  const days = daySlots(march)
  expect(days[days.length - 1].date.getDate()).toBe(10)
  expect(days.map((slot) => slot.date.getDate())).toEqual(Array.from({length: 10}, (_, i) => i + 1))
})
