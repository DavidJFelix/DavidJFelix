import {parseISO} from 'date-fns'
import {expect, test} from 'vitest'
import {RACE_DISTANCE_MILES} from './constants'
import {generatePlan} from './generate'
import {trainingPaces} from './paces'

// David's actual 2026 plan: marathon on Sunday 2026-10-18, 20 weeks.
// Counting back 20 weeks lands the start on Monday 2026-06-01.
const twentyWeekMarathon = {
  race: {distance: 'marathon', date: '2026-10-18'},
  runner: {weeklyMileage: 24},
  durationWeeks: 20,
} as const

test('anchors the plan on race day: N weeks of 7 days ending on the race date', () => {
  const plan = generatePlan(twentyWeekMarathon)
  expect(plan.weeks).toHaveLength(20)
  expect(plan.startDate).toBe('2026-06-01')
  expect(plan.weeks[0]?.days[0]?.date).toBe('2026-06-01')
  const raceDay = plan.weeks[19]?.days[6]
  expect(raceDay?.date).toBe('2026-10-18')
  expect(raceDay?.workout?.type).toBe('race')
})

test('puts one long run on the chosen weekday each week, except race week', () => {
  const plan = generatePlan(twentyWeekMarathon) // default long-run day: Saturday
  for (const week of plan.weeks.slice(0, -1)) {
    const longDays = week.days.filter((day) => day.workout?.type === 'long')
    expect(longDays).toHaveLength(1)
    expect(parseISO(longDays[0]?.date ?? '').getDay()).toBe(6)
  }
  const raceWeek = plan.weeks[19]
  expect(raceWeek?.days.filter((day) => day.workout?.type === 'long')).toHaveLength(0)
  // Race week winds down: shakeout the day before, full rest two days out.
  expect(raceWeek?.days[5]?.workout?.type).toBe('shakeout')
  expect(raceWeek?.days[4]?.workout).toBeUndefined()
})

// A Saturday long run rotates the rest of the week around it, Monday first:
// rest, tempo, easy, quality, easy, long, recovery. During base the quality
// slot stays an easy run.
test('rotates the week template around the long run', () => {
  const plan = generatePlan(twentyWeekMarathon)
  const baseWeek = plan.weeks[1]
  const types = baseWeek?.days.map((day) => day.workout?.type)
  expect(types).toEqual([undefined, 'tempo', 'easy', 'easy', 'easy', 'long', 'recovery'])
})

// The quality slot (Thursday for a Saturday long run) runs easy during
// base, then becomes an interval session from build onward — including
// taper, where sessions shrink but intensity stays.
test('switches the quality day from easy to intervals at the build phase', () => {
  const plan = generatePlan(twentyWeekMarathon)
  for (const week of plan.weeks) {
    const qualityType = week.days[3]?.workout?.type
    if (week.phase === 'base') expect(qualityType).toBe('easy')
    if (week.phase === 'build' || week.phase === 'peak' || week.phase === 'taper') {
      expect(qualityType).toBe('interval')
    }
  }
})

// Every 4th week is a stepback (recovery) week — David's 2026 plan steps
// back on weeks 4, 8, 12, 16 — but taper and race weeks never step back.
test('marks every 4th week as a stepback, except during taper and race', () => {
  const plan = generatePlan(twentyWeekMarathon)
  const stepbacks = plan.weeks.filter((week) => week.isStepback).map((week) => week.index)
  expect(stepbacks).toEqual([3, 7, 11, 15])

  // A default 12-week half: the every-4th cadence would hit race week, so
  // only two stepbacks fit.
  const half = generatePlan({
    race: {distance: 'half', date: '2026-10-18'},
    runner: {weeklyMileage: 20},
  })
  expect(half.weeks.filter((week) => week.isStepback).map((week) => week.index)).toEqual([3, 7])
})

// Long runs start from current fitness (~40% of weekly volume: 24mpw → 10mi,
// same as David's real plan), climb to the marathon peak of 20mi landing in
// the peak phase, dip on stepback weeks, then shrink through the taper
// (60% / 40% of peak).
test('progresses the long run from current fitness to the distance peak and back down', () => {
  const plan = generatePlan(twentyWeekMarathon)
  const longMiles = plan.weeks.map(
    (week) => week.days.find((day) => day.workout?.type === 'long')?.workout?.distanceMiles,
  )
  expect(longMiles[0]).toBe(10)
  expect(longMiles[16]).toBe(20)
  expect(plan.weeks[16]?.phase).toBe('peak')
  expect(longMiles[17]).toBe(12)
  expect(longMiles[18]).toBe(8)
  for (let i = 1; i <= 16; i++) {
    const current = longMiles[i] ?? 0
    const previous = longMiles[i - 1] ?? 0
    if (plan.weeks[i]?.isStepback) {
      expect(current).toBeLessThan(previous)
    } else if (!plan.weeks[i - 1]?.isStepback) {
      expect(current).toBeGreaterThanOrEqual(previous)
    }
  }
})

// Weekly volume derives from the long run (long ≈ 42% of the week, the
// ratio David's real plan holds). Week 1 lands near current weekly mileage,
// growth between full weeks stays under ~10%, stepbacks dip below both
// neighbors, and totals always equal the sum of the days.
test('builds weekly volume around the long run without unsafe ramps', () => {
  const plan = generatePlan(twentyWeekMarathon)

  expect(plan.weeks[0]?.totalMiles).toBeGreaterThanOrEqual(22)
  expect(plan.weeks[0]?.totalMiles).toBeLessThanOrEqual(26)

  for (const week of plan.weeks) {
    const dayMiles = week.days.reduce((sum, day) => sum + (day.workout?.distanceMiles ?? 0), 0)
    expect(week.totalMiles).toBeCloseTo(dayMiles, 5)
    for (const day of week.days) {
      if (day.workout) expect(day.workout.distanceMiles).toBeGreaterThanOrEqual(1)
    }
  }

  for (let i = 1; i < plan.weeks.length - 1; i++) {
    const week = plan.weeks[i]
    const previous = plan.weeks[i - 1]
    if (!week || !previous || week.phase === 'taper' || week.phase === 'race') continue
    if (week.isStepback) {
      expect(week.totalMiles).toBeLessThan(previous.totalMiles)
      expect(week.totalMiles).toBeLessThan(plan.weeks[i + 1]?.totalMiles ?? 0)
    } else if (!previous.isStepback) {
      expect(week.totalMiles / previous.totalMiles).toBeLessThanOrEqual(1.11)
    }
  }

  const raceDay = plan.weeks[19]?.days[6]
  expect(raceDay?.workout?.distanceMiles).toBeCloseTo(26.2, 1)
})

// Given a recent race, every training run carries its pace band, and race
// day carries the goal pace (4:30:00 over 26.21875mi ≈ 618 s/mi). Without a
// recent race, workouts stay pace-free.
test('attaches pace bands from a recent race and the goal time', () => {
  const recentRace = {distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds: 25 * 60}
  const plan = generatePlan({
    race: {distance: 'marathon', date: '2026-10-18', goalTimeSeconds: 4.5 * 3600},
    runner: {weeklyMileage: 24, recentRace},
    durationWeeks: 20,
  })
  const expected = trainingPaces(recentRace)
  const buildWeek = plan.weeks[9]
  expect(buildWeek?.days[1]?.workout?.paceBand).toEqual(expected.tempo)
  expect(buildWeek?.days[3]?.workout?.paceBand).toEqual(expected.interval)
  expect(buildWeek?.days[4]?.workout?.paceBand).toEqual(expected.easy)
  expect(buildWeek?.days[5]?.workout?.paceBand).toEqual(expected.long)
  expect(buildWeek?.days[6]?.workout?.paceBand).toEqual(expected.recovery)
  const raceBand = plan.weeks[19]?.days[6]?.workout?.paceBand
  expect(raceBand?.minSecondsPerMile).toBeCloseTo(618, 0)
  expect(raceBand?.maxSecondsPerMile).toBeCloseTo(618, 0)

  const planWithoutPaces = generatePlan(twentyWeekMarathon)
  for (const week of planWithoutPaces.weeks) {
    for (const day of week.days) {
      expect(day.workout?.paceBand).toBeUndefined()
    }
  }

  // No goal time? Race day falls back to the Riegel prediction (~549 s/mi).
  const predictedPlan = generatePlan({
    race: {distance: 'marathon', date: '2026-10-18'},
    runner: {weeklyMileage: 24, recentRace},
    durationWeeks: 20,
  })
  const predictedBand = predictedPlan.weeks[19]?.days[6]?.workout?.paceBand
  expect(predictedBand?.minSecondsPerMile).toBeCloseTo(549, 0)
})

// The schedule shape is flexible: a Sunday long run rotates the whole week
// with it (recovery Monday, rest Tuesday, tempo Wednesday...).
test('moves the whole rotation when the long run day changes', () => {
  const plan = generatePlan({
    ...twentyWeekMarathon,
    runner: {weeklyMileage: 24, longRunDay: 0},
  })
  for (const week of plan.weeks.slice(0, -1)) {
    const longDay = week.days.find((day) => day.workout?.type === 'long')
    expect(parseISO(longDay?.date ?? '').getDay()).toBe(0)
    const longIndex = week.days.indexOf(longDay ?? week.days[0])
    expect(week.days[(longIndex + 1) % 7]?.workout?.type).toBe('recovery')
  }
})

// Phases run base → build → peak → taper → race, never backward, all
// present. A marathon tapers for 2 weeks before race week.
test('assigns forward-only phases with a 2-week marathon taper', () => {
  const plan = generatePlan(twentyWeekMarathon)
  const phases = plan.weeks.map((week) => week.phase)
  expect(phases[0]).toBe('base')
  expect(phases[19]).toBe('race')
  expect(phases.filter((phase) => phase === 'taper')).toHaveLength(2)
  expect(new Set(phases).size).toBe(5)
  const order = ['base', 'build', 'peak', 'taper', 'race']
  const ranks = phases.map((phase) => order.indexOf(phase))
  for (let i = 1; i < ranks.length; i++) {
    expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1] ?? 0)
  }
})
