import {PLAN_RULES, RACE_DISTANCE_MILES} from './constants'

export interface RaceResult {
  distanceMiles: number
  timeSeconds: number
}

export interface PaceBand {
  minSecondsPerMile: number
  maxSecondsPerMile: number
}

export type TrainingPaceKind = 'easy' | 'long' | 'recovery' | 'tempo' | 'interval'

export type TrainingPaces = Record<TrainingPaceKind, PaceBand>

export function predictRaceTime(recent: RaceResult, targetDistanceMiles: number): number {
  return (
    recent.timeSeconds * (targetDistanceMiles / recent.distanceMiles) ** PLAN_RULES.riegelExponent
  )
}

function predictedPacePerMile(recent: RaceResult, targetDistanceMiles: number): number {
  return predictRaceTime(recent, targetDistanceMiles) / targetDistanceMiles
}

function band(kind: TrainingPaceKind, fastEndSecondsPerMile: number): PaceBand {
  return {
    minSecondsPerMile: fastEndSecondsPerMile,
    maxSecondsPerMile: fastEndSecondsPerMile + PLAN_RULES.paceBandWidthSeconds[kind],
  }
}

export function formatPace(secondsPerMile: number): string {
  const total = Math.round(secondsPerMile)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatDuration(totalSeconds: number): string {
  const total = Math.round(totalSeconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours === 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function parseDuration(text: string): number {
  const parts = text.split(':').map(Number)
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export function trainingPaces(recent: RaceResult): TrainingPaces {
  const easy =
    predictedPacePerMile(recent, RACE_DISTANCE_MILES.marathon) + PLAN_RULES.easyOverMarathonPace
  return {
    easy: band('easy', easy),
    long: band('long', easy + PLAN_RULES.longOverEasyPace),
    recovery: band('recovery', easy + PLAN_RULES.recoveryOverEasyPace),
    tempo: band(
      'tempo',
      predictedPacePerMile(recent, RACE_DISTANCE_MILES.tenK) + PLAN_RULES.tempoOverTenKPace,
    ),
    interval: band('interval', predictedPacePerMile(recent, RACE_DISTANCE_MILES.fiveK)),
  }
}
