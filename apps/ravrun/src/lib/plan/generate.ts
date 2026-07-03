import {addDays, format, getDay, parseISO} from 'date-fns'
import {DEFAULT_DURATION_WEEKS, PLAN_RULES, RACE_DISTANCE_MILES} from './constants'
import type {PaceBand, RaceResult, TrainingPaces} from './paces'
import {predictRaceTime, trainingPaces} from './paces'

export type RaceDistance = keyof typeof RACE_DISTANCE_MILES

export type WorkoutType = 'easy' | 'long' | 'recovery' | 'tempo' | 'interval' | 'shakeout' | 'race'

export type WeekPhase = 'base' | 'build' | 'peak' | 'taper' | 'race'

export interface Workout {
  type: WorkoutType
  distanceMiles?: number
  paceBand?: PaceBand
}

export interface PlanDay {
  date: string
  workout?: Workout
}

export interface PlanWeek {
  index: number
  phase: WeekPhase
  isStepback: boolean
  totalMiles: number
  days: PlanDay[]
}

export interface PlanRequest {
  race: {
    distance: RaceDistance
    date: string
    goalTimeSeconds?: number
  }
  runner: {
    weeklyMileage: number
    recentRace?: RaceResult
    longRunDay?: number
  }
  durationWeeks?: number
}

export interface TrainingPlan {
  startDate: string
  raceDate: string
  weeks: PlanWeek[]
}

function assignPhases(durationWeeks: number, distance: RaceDistance): WeekPhase[] {
  const taperWeeks = PLAN_RULES.taperWeeks[distance]
  const progressionWeeks = durationWeeks - taperWeeks - 1
  const baseWeeks = Math.round(progressionWeeks * PLAN_RULES.basePortion)
  const buildWeeks = Math.round(progressionWeeks * PLAN_RULES.buildPortion)
  return Array.from({length: durationWeeks}, (_, weekIndex): WeekPhase => {
    if (weekIndex === durationWeeks - 1) return 'race'
    if (weekIndex >= progressionWeeks) return 'taper'
    if (weekIndex >= baseWeeks + buildWeeks) return 'peak'
    if (weekIndex >= baseWeeks) return 'build'
    return 'base'
  })
}

function assignStepbacks(phases: WeekPhase[]): boolean[] {
  return phases.map(
    (phase, weekIndex) =>
      (weekIndex + 1) % PLAN_RULES.stepbackEveryNthWeek === 0 &&
      phase !== 'taper' &&
      phase !== 'race',
  )
}

// How many week-over-week growth steps a plan of this length offers: the
// count of full (non-stepback) weeks before taper, minus one. Feasibility
// uses this to judge whether the volume ramp can stay safe.
export function progressionSteps(durationWeeks: number, distance: RaceDistance): number {
  const phases = assignPhases(durationWeeks, distance)
  const stepbacks = assignStepbacks(phases)
  const fullWeeks = phases.filter(
    (phase, weekIndex) => !stepbacks[weekIndex] && phase !== 'taper' && phase !== 'race',
  ).length
  return Math.max(1, fullWeeks - 1)
}

// Long-run distance per week: linear climb from a fitness-derived start to
// the distance peak across non-stepback progression weeks; stepbacks dip to
// a fraction of the previous long run; taper weeks shrink from the peak.
function longRunMilesByWeek(args: {
  phases: WeekPhase[]
  stepbacks: boolean[]
  distance: RaceDistance
  weeklyMileage: number
}): (number | undefined)[] {
  const {phases, stepbacks, distance, weeklyMileage} = args
  const peak = PLAN_RULES.peakLongRunMiles[distance]
  const start = Math.min(
    peak,
    Math.max(PLAN_RULES.longRunFloorMiles, weeklyMileage * PLAN_RULES.longRunStartFraction),
  )
  const progressionIndices = phases
    .map((phase, weekIndex) => weekIndex)
    .filter(
      (weekIndex) =>
        !stepbacks[weekIndex] && phases[weekIndex] !== 'taper' && phases[weekIndex] !== 'race',
    )
  const lastStep = Math.max(1, progressionIndices.length - 1)

  let previousFullLong = start
  let taperWeekNumber = 0
  return phases.map((phase, weekIndex) => {
    if (phase === 'race') return undefined
    if (phase === 'taper') {
      const factors = PLAN_RULES.taperLongRunFactors
      const factor = factors[Math.min(taperWeekNumber, factors.length - 1)] ?? 1
      taperWeekNumber += 1
      return Math.round(peak * factor)
    }
    if (stepbacks[weekIndex]) {
      return Math.round(previousFullLong * PLAN_RULES.stepbackVolumeFactor)
    }
    const step = progressionIndices.indexOf(weekIndex)
    previousFullLong = start + ((peak - start) * step) / lastStep
    return Math.round(previousFullLong)
  })
}

// Race day runs at the goal pace when one is set, else at the Riegel
// prediction from the recent race. Shakeout and rest days carry no pace.
function racePaceBand(request: PlanRequest): PaceBand | undefined {
  const distanceMiles = RACE_DISTANCE_MILES[request.race.distance]
  const goalSeconds =
    request.race.goalTimeSeconds ??
    (request.runner.recentRace
      ? predictRaceTime(request.runner.recentRace, distanceMiles)
      : undefined)
  if (goalSeconds === undefined) return undefined
  const pace = goalSeconds / distanceMiles
  return {minSecondsPerMile: pace, maxSecondsPerMile: pace}
}

function paceBandFor(
  type: WorkoutType,
  paces: TrainingPaces | undefined,
  raceBand: PaceBand | undefined,
): PaceBand | undefined {
  if (type === 'race') return raceBand
  if (type === 'shakeout') return undefined
  return paces?.[type]
}

// When the goal outruns current fitness, training bands drift linearly from
// current-fitness paces toward goal-fitness paces across the block. A goal
// slower than predicted never drags training paces backward.
function goalFitnessPaces(request: PlanRequest): TrainingPaces | undefined {
  const {recentRace} = request.runner
  const {goalTimeSeconds} = request.race
  if (recentRace === undefined || goalTimeSeconds === undefined) return undefined
  const distanceMiles = RACE_DISTANCE_MILES[request.race.distance]
  if (goalTimeSeconds >= predictRaceTime(recentRace, distanceMiles)) return undefined
  return trainingPaces({distanceMiles, timeSeconds: goalTimeSeconds})
}

function lerpBand(from: PaceBand, to: PaceBand, fraction: number): PaceBand {
  return {
    minSecondsPerMile:
      from.minSecondsPerMile + (to.minSecondsPerMile - from.minSecondsPerMile) * fraction,
    maxSecondsPerMile:
      from.maxSecondsPerMile + (to.maxSecondsPerMile - from.maxSecondsPerMile) * fraction,
  }
}

function driftedPaces(
  paces: TrainingPaces | undefined,
  goalPaces: TrainingPaces | undefined,
  fraction: number,
): TrainingPaces | undefined {
  if (paces === undefined || goalPaces === undefined) return paces
  return {
    easy: lerpBand(paces.easy, goalPaces.easy, fraction),
    long: lerpBand(paces.long, goalPaces.long, fraction),
    recovery: lerpBand(paces.recovery, goalPaces.recovery, fraction),
    tempo: lerpBand(paces.tempo, goalPaces.tempo, fraction),
    interval: lerpBand(paces.interval, goalPaces.interval, fraction),
  }
}

function raceWeekWorkout(dayIndex: number, distance: RaceDistance): Workout | undefined {
  if (dayIndex === 6) return {type: 'race', distanceMiles: RACE_DISTANCE_MILES[distance]}
  if (dayIndex === 5) return {type: 'shakeout', distanceMiles: PLAN_RULES.shakeoutMiles}
  if (dayIndex === 4) return undefined
  const firstEasyIndex = 4 - PLAN_RULES.raceWeekEasyRunCount
  if (dayIndex < firstEasyIndex) return undefined
  const peakVolume = Math.round(
    PLAN_RULES.peakLongRunMiles[distance] / PLAN_RULES.longRunShareOfWeek,
  )
  const share = PLAN_RULES.raceWeekEasyShares[dayIndex - firstEasyIndex] ?? 0
  return {type: 'easy', distanceMiles: Math.max(1, Math.round(share * peakVolume))}
}

export function generatePlan(request: PlanRequest): TrainingPlan {
  const durationWeeks = request.durationWeeks ?? DEFAULT_DURATION_WEEKS[request.race.distance]
  if (!Number.isInteger(durationWeeks) || durationWeeks < 1) {
    throw new RangeError('durationWeeks must be a positive integer')
  }
  const longRunDay = request.runner.longRunDay ?? PLAN_RULES.defaultLongRunDay
  if (!Number.isInteger(longRunDay) || longRunDay < 0 || longRunDay > 6) {
    throw new RangeError('longRunDay must be an integer from 0 (Sunday) to 6 (Saturday)')
  }
  const raceDate = parseISO(request.race.date)
  const startDate = addDays(raceDate, -(durationWeeks * 7 - 1))
  const paces = request.runner.recentRace ? trainingPaces(request.runner.recentRace) : undefined
  const goalPaces = goalFitnessPaces(request)
  const raceBand = racePaceBand(request)
  const phases = assignPhases(durationWeeks, request.race.distance)
  const stepbacks = assignStepbacks(phases)
  const longRuns = longRunMilesByWeek({
    phases,
    stepbacks,
    distance: request.race.distance,
    weeklyMileage: request.runner.weeklyMileage,
  })

  const weeks = Array.from({length: durationWeeks}, (_, weekIndex): PlanWeek => {
    const phase = phases[weekIndex] ?? 'base'
    const isRaceWeek = phase === 'race'
    const isStepback = stepbacks[weekIndex] ?? false
    const weekDates = Array.from({length: 7}, (_, dayIndex) =>
      addDays(startDate, weekIndex * 7 + dayIndex),
    )
    const longRunIndex = weekDates.findIndex((date) => getDay(date) === longRunDay)

    const longMiles = longRuns[weekIndex] ?? 0
    const weekVolume = Math.round(longMiles / PLAN_RULES.longRunShareOfWeek)
    const remainder = weekVolume - longMiles

    const workouts = weekDates.map((_, dayIndex): Workout | undefined => {
      if (isRaceWeek) return raceWeekWorkout(dayIndex, request.race.distance)
      const slot = (dayIndex - longRunIndex + 7) % 7
      const templateType = PLAN_RULES.weekTemplate[slot]
      if (templateType === 'rest') return undefined
      if (templateType === 'long') return {type: 'long', distanceMiles: longMiles}
      const type: WorkoutType =
        templateType === 'quality'
          ? phase === 'base'
            ? 'easy'
            : 'interval'
          : (templateType as WorkoutType)
      const share = PLAN_RULES.remainderShareBySlot[slot] ?? 0
      return {type, distanceMiles: Math.max(1, Math.round(share * remainder))}
    })

    // Rounding can leave the week a mile or two off its volume target; the
    // midweek easy day (slot 4) absorbs the difference.
    if (!isRaceWeek) {
      const sum = workouts.reduce((total, workout) => total + (workout?.distanceMiles ?? 0), 0)
      const midweekEasy = workouts[(longRunIndex + 4) % 7]
      if (midweekEasy?.distanceMiles !== undefined) {
        midweekEasy.distanceMiles = Math.max(1, midweekEasy.distanceMiles + weekVolume - sum)
      }
    }

    const driftFraction = durationWeeks <= 1 ? 1 : weekIndex / (durationWeeks - 1)
    const weekPaces = driftedPaces(paces, goalPaces, driftFraction)
    const days = weekDates.map((date, dayIndex): PlanDay => {
      const workout = workouts[dayIndex]
      return {
        date: format(date, 'yyyy-MM-dd'),
        workout: workout && {...workout, paceBand: paceBandFor(workout.type, weekPaces, raceBand)},
      }
    })
    const totalMiles = workouts.reduce((total, workout) => total + (workout?.distanceMiles ?? 0), 0)
    return {index: weekIndex, phase, isStepback, totalMiles, days}
  })

  return {startDate: format(startDate, 'yyyy-MM-dd'), raceDate: request.race.date, weeks}
}
