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
  const qualityTypes = (phases: string[]) =>
    plan.weeks
      .filter((week) => phases.includes(week.phase))
      .map((week) => week.days[3]?.workout?.type)
  for (const type of qualityTypes(['base'])) {
    expect(type).toBe('easy')
  }
  for (const type of qualityTypes(['build', 'peak', 'taper'])) {
    expect(type).toBe('interval')
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
  const stepbackWeeks = plan.weeks.filter((week) => week.isStepback)
  for (const week of stepbackWeeks) {
    expect(longMiles[week.index] ?? 0).toBeLessThan(longMiles[week.index - 1] ?? 0)
  }
  const climbingWeeks = plan.weeks.filter(
    (week) =>
      week.index >= 1 &&
      week.index <= 16 &&
      !week.isStepback &&
      !plan.weeks[week.index - 1]?.isStepback,
  )
  for (const week of climbingWeeks) {
    expect(longMiles[week.index] ?? 0).toBeGreaterThanOrEqual(longMiles[week.index - 1] ?? 0)
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
    const workouts = week.days.flatMap((day) => (day.workout ? [day.workout] : []))
    for (const workout of workouts) {
      expect(workout.distanceMiles).toBeGreaterThanOrEqual(1)
    }
  }

  const progressionWeeks = plan.weeks.filter(
    (week) =>
      week.index >= 1 &&
      week.index < plan.weeks.length - 1 &&
      week.phase !== 'taper' &&
      week.phase !== 'race',
  )
  for (const week of progressionWeeks.filter((week) => week.isStepback)) {
    expect(week.totalMiles).toBeLessThan(plan.weeks[week.index - 1]?.totalMiles ?? 0)
    expect(week.totalMiles).toBeLessThan(plan.weeks[week.index + 1]?.totalMiles ?? 0)
  }
  const climbs = progressionWeeks.filter(
    (week) => !week.isStepback && !plan.weeks[week.index - 1]?.isStepback,
  )
  for (const week of climbs) {
    expect(week.totalMiles / (plan.weeks[week.index - 1]?.totalMiles ?? 1)).toBeLessThanOrEqual(
      1.11,
    )
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

// When the goal outruns current fitness, training paces drift from
// current-fitness bands toward goal-fitness bands across the block (as
// David's real plan does). Week 1 trains where you are; the final training
// week sits near where you're going. A slower-than-predicted goal never
// drags paces backward (pinned by the static-band assertions above).
test('drifts pace bands toward goal fitness when the goal is faster', () => {
  const recentRace = {distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds: 25 * 60}
  const plan = generatePlan({
    race: {distance: 'marathon', date: '2026-10-18', goalTimeSeconds: 3.5 * 3600},
    runner: {weeklyMileage: 24, recentRace},
    durationWeeks: 20,
  })
  const easyMin = (weekIndex: number) =>
    plan.weeks[weekIndex]?.days.find((day) => day.workout?.type === 'easy')?.workout?.paceBand
      ?.minSecondsPerMile ?? 0

  const current = trainingPaces(recentRace)
  expect(easyMin(0)).toBeCloseTo(current.easy.minSecondsPerMile, 5)
  expect(easyMin(9)).toBeLessThan(easyMin(0))
  expect(easyMin(18)).toBeLessThan(easyMin(9))

  const goalFitness = trainingPaces({
    distanceMiles: RACE_DISTANCE_MILES.marathon,
    timeSeconds: 3.5 * 3600,
  })
  expect(Math.abs(easyMin(18) - goalFitness.easy.minSecondsPerMile)).toBeLessThan(5)
})

// The engine is an exported API: garbage durations or weekdays fail fast
// instead of silently building a malformed schedule.
test('rejects invalid duration and long-run day', () => {
  expect(() => generatePlan({...twentyWeekMarathon, durationWeeks: 0})).toThrow(RangeError)
  expect(() => generatePlan({...twentyWeekMarathon, durationWeeks: 10.5})).toThrow(RangeError)
  expect(() =>
    generatePlan({...twentyWeekMarathon, runner: {weeklyMileage: 24, longRunDay: 7}}),
  ).toThrow(RangeError)
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
