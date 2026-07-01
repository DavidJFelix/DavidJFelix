import {expect, test} from 'vitest'
import {RACE_DISTANCE_MILES} from './constants'
import {assessFeasibility} from './feasibility'
import {predictRaceTime} from './paces'

const recentRace = {distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds: 25 * 60}
const predicted = predictRaceTime(recentRace, RACE_DISTANCE_MILES.marathon)

function marathonRequest(goalTimeSeconds: number) {
  return {
    race: {distance: 'marathon', date: '2026-10-18', goalTimeSeconds},
    runner: {weeklyMileage: 24, recentRace},
    durationWeeks: 20,
  } as const
}

// Reaching marathon peak volume (~48mpw) from a 12mpw base inside 20 weeks
// needs >10% weekly jumps — injury territory. The finding suggests a longer
// plan, and that suggestion must actually resolve its own warning.
test('flags unsafe mileage ramps and suggests a duration that heals them', () => {
  const lowMileage = {
    race: {distance: 'marathon', date: '2026-10-18'},
    runner: {weeklyMileage: 12},
    durationWeeks: 20,
  } as const
  const findings = assessFeasibility(lowMileage)
  const ramp = findings.find((finding) => finding.code === 'ramp-too-steep')
  expect(ramp?.level).toBe('warning')
  expect(ramp?.suggestedWeeks).toBeGreaterThan(20)

  const longer = assessFeasibility({...lowMileage, durationWeeks: ramp?.suggestedWeeks})
  expect(longer.find((finding) => finding.code === 'ramp-too-steep')).toBeUndefined()

  const solidBase = assessFeasibility({...lowMileage, runner: {weeklyMileage: 24}})
  expect(solidBase.find((finding) => finding.code === 'ramp-too-steep')).toBeUndefined()
})

// A 20-week plan for 2026-10-18 starts 2026-06-01. Checking feasibility on
// July 1 means the window is 4 weeks gone — worth a warning, not silence.
// A race date in the past is a dead plan.
test('warns when the training window is already underway or the race has passed', () => {
  const request = {
    race: {distance: 'marathon', date: '2026-10-18'},
    runner: {weeklyMileage: 24},
    durationWeeks: 20,
  } as const

  const underway = assessFeasibility(request, {today: '2026-07-01'}).find(
    (finding) => finding.code === 'window-underway',
  )
  expect(underway?.level).toBe('warning')
  expect(underway?.message).toContain('4 weeks')

  const beforehand = assessFeasibility(request, {today: '2026-05-20'})
  expect(beforehand.find((finding) => finding.code === 'window-underway')).toBeUndefined()

  const passed = assessFeasibility(request, {today: '2026-10-19'}).find(
    (finding) => finding.code === 'race-passed',
  )
  expect(passed?.level).toBe('danger')
})

// A runner already at or above peak volume has nothing to ramp, and a goal
// without a recent race has nothing to judge against — both stay quiet, and
// a clean request produces zero findings.
test('stays quiet without a fitness gap or a comparison point', () => {
  const highMileage = assessFeasibility({
    race: {distance: 'marathon', date: '2026-10-18', goalTimeSeconds: 4 * 3600},
    runner: {weeklyMileage: 55},
    durationWeeks: 20,
  })
  expect(highMileage).toEqual([])
})

// Even a well-based runner shouldn't compress a marathon block below the
// distance minimum (12 weeks).
test('warns when the plan is shorter than the distance minimum', () => {
  const short = assessFeasibility({
    race: {distance: 'marathon', date: '2026-10-18'},
    runner: {weeklyMileage: 40},
    durationWeeks: 8,
  })
  expect(short.find((finding) => finding.code === 'plan-too-short')?.level).toBe('warning')

  const fine = assessFeasibility({
    race: {distance: 'marathon', date: '2026-10-18'},
    runner: {weeklyMileage: 40},
    durationWeeks: 16,
  })
  expect(fine.find((finding) => finding.code === 'plan-too-short')).toBeUndefined()
})

// A goal within 5% of the Riegel prediction passes quietly; 5-10% faster
// earns an "aggressive" warning; beyond 10% is blow-up territory.
test('flags goals that outrun the fitness the recent race predicts', () => {
  const realistic = assessFeasibility(marathonRequest(predicted * 0.99))
  expect(realistic.find((finding) => finding.code.includes('goal'))).toBeUndefined()

  const aggressive = assessFeasibility(marathonRequest(predicted * 0.93))
  expect(aggressive.find((finding) => finding.code === 'aggressive-goal')?.level).toBe('warning')

  const unrealistic = assessFeasibility(marathonRequest(predicted * 0.88))
  expect(unrealistic.find((finding) => finding.code === 'unrealistic-goal')?.level).toBe('danger')
})
