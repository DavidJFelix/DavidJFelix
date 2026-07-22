import {expect, test} from 'vitest'
import {RACE_DISTANCE_MILES} from './constants'
import {generatePlan} from './generate'
import {planToIcs} from './ics'

const plan = generatePlan({
  race: {distance: 'marathon', date: '2026-10-18', goalTimeSeconds: 4.5 * 3600},
  runner: {
    weeklyMileage: 24,
    recentRace: {distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds: 25 * 60},
  },
  durationWeeks: 20,
})

// One all-day VEVENT per workout, wrapped in a valid VCALENDAR. All-day
// events use DTSTART;VALUE=DATE with an exclusive next-day DTEND.
test('exports every workout as an all-day calendar event', () => {
  const ics = planToIcs(plan)
  expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
  expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)

  const workoutCount = plan.weeks
    .flatMap((week) => week.days)
    .filter((day) => day.workout !== undefined).length
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(workoutCount)
  expect(ics.match(/END:VEVENT/g)).toHaveLength(workoutCount)

  // The first long run: Saturday 2026-06-06, 10 miles.
  expect(ics).toContain('SUMMARY:Long Run - 10')
  expect(ics).toContain('DTSTART;VALUE=DATE:20260606')
  expect(ics).toContain('DTEND;VALUE=DATE:20260607')
  // Race day.
  expect(ics).toContain('SUMMARY:RACE! - 26.2')
  expect(ics).toContain('DTSTART;VALUE=DATE:20261018')
})

// Events describe the workout the way the grid does: distance, the pace
// band when one exists, and which week/phase of the block this is. DTSTAMP
// is derived from the plan start so exports stay deterministic.
test('describes workouts with distance, pace, and week context', () => {
  const ics = planToIcs(plan)
  // First long run: 10 miles at the long band (10:39-11:03 with a 25:00 5K).
  expect(ics).toContain(
    'DESCRIPTION:Distance: 10 miles\\nPace: 10:39-11:03 /mi\\nWeek 1 of 20 - base',
  )
  // Shakeout has no pace band; description skips the pace line.
  expect(ics).toContain('DESCRIPTION:Distance: 2 miles\\nWeek 20 of 20 - race')
  expect(ics).toContain('DTSTAMP:20260601T000000Z')
  // Race day has a single goal pace, not a band — print it once.
  expect(ics).toContain('Pace: 10:18 /mi')
})
