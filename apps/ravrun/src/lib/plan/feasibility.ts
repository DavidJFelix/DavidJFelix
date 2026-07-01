import {differenceInCalendarDays, parseISO} from 'date-fns'
import {DEFAULT_DURATION_WEEKS, PLAN_RULES, RACE_DISTANCE_MILES} from './constants'
import type {PlanRequest} from './generate'
import {progressionSteps} from './generate'
import {formatDuration, predictRaceTime} from './paces'

export type FindingLevel = 'info' | 'warning' | 'danger'

export interface Finding {
  level: FindingLevel
  code: string
  message: string
  suggestedWeeks?: number
}

function goalGapFinding(request: PlanRequest): Finding | undefined {
  const {goalTimeSeconds} = request.race
  const {recentRace} = request.runner
  if (goalTimeSeconds === undefined || recentRace === undefined) return undefined

  const predicted = predictRaceTime(recentRace, RACE_DISTANCE_MILES[request.race.distance])
  const gap = (predicted - goalTimeSeconds) / predicted
  if (gap > PLAN_RULES.goalGapDangerFraction) {
    return {
      level: 'danger',
      code: 'unrealistic-goal',
      message: `Your recent race predicts ${formatDuration(predicted)}; a goal this much faster risks blowing up on race day.`,
    }
  }
  if (gap > PLAN_RULES.goalGapWarningFraction) {
    return {
      level: 'warning',
      code: 'aggressive-goal',
      message: `Your recent race predicts ${formatDuration(predicted)}; this goal is aggressive but within reach on a strong block.`,
    }
  }
  return undefined
}

function rampFinding(request: PlanRequest): Finding | undefined {
  const {distance} = request.race
  const durationWeeks = request.durationWeeks ?? DEFAULT_DURATION_WEEKS[distance]
  const peakVolume = Math.round(
    PLAN_RULES.peakLongRunMiles[distance] / PLAN_RULES.longRunShareOfWeek,
  )
  const current = request.runner.weeklyMileage
  if (current >= peakVolume) return undefined

  const growthPerStep = (weeks: number) =>
    (peakVolume / current) ** (1 / progressionSteps(weeks, distance)) - 1
  if (growthPerStep(durationWeeks) <= PLAN_RULES.weeklyRampCap) return undefined

  let suggestedWeeks = durationWeeks
  while (
    suggestedWeeks < PLAN_RULES.maxSuggestedWeeks &&
    growthPerStep(suggestedWeeks) > PLAN_RULES.weeklyRampCap
  ) {
    suggestedWeeks += 1
  }
  return {
    level: 'warning',
    code: 'ramp-too-steep',
    message: `Reaching ~${peakVolume} miles/week from ${current} in ${durationWeeks} weeks means growing faster than ${Math.round(PLAN_RULES.weeklyRampCap * 100)}% a week — an injury risk. Consider ${suggestedWeeks} weeks.`,
    suggestedWeeks,
  }
}

function durationFinding(request: PlanRequest): Finding | undefined {
  const {distance} = request.race
  const durationWeeks = request.durationWeeks ?? DEFAULT_DURATION_WEEKS[distance]
  const minimum = PLAN_RULES.minDurationWeeks[distance]
  if (durationWeeks >= minimum) return undefined
  return {
    level: 'warning',
    code: 'plan-too-short',
    message: `${durationWeeks} weeks is a very compressed block for this distance — ${minimum}+ weeks leaves room to build and taper properly.`,
    suggestedWeeks: minimum,
  }
}

function timingFinding(request: PlanRequest, today: string | undefined): Finding | undefined {
  if (today === undefined) return undefined
  const durationWeeks = request.durationWeeks ?? DEFAULT_DURATION_WEEKS[request.race.distance]
  const raceDate = parseISO(request.race.date)
  const todayDate = parseISO(today)
  if (differenceInCalendarDays(raceDate, todayDate) <= 0) {
    return {
      level: 'danger',
      code: 'race-passed',
      message: 'This race date has already passed — pick the next goal race.',
    }
  }
  const daysUnderway = durationWeeks * 7 - 1 - differenceInCalendarDays(raceDate, todayDate)
  if (daysUnderway <= 0) return undefined
  const weeksUnderway = Math.floor(daysUnderway / 7)
  return {
    level: 'warning',
    code: 'window-underway',
    message: `A ${durationWeeks}-week plan for this race is already ${weeksUnderway} weeks underway — you are joining it mid-block.`,
  }
}

export interface FeasibilityOptions {
  today?: string
}

export function assessFeasibility(request: PlanRequest, options?: FeasibilityOptions): Finding[] {
  const findings = [
    goalGapFinding(request),
    rampFinding(request),
    durationFinding(request),
    timingFinding(request, options?.today),
  ]
  return findings.filter((finding) => finding !== undefined)
}
