import {addDays, format, parseISO} from 'date-fns'
import type {PlanWeek, TrainingPlan, Workout, WorkoutType} from './generate'
import type {PaceBand} from './paces'
import {formatPace} from './paces'

const WORKOUT_LABELS: Record<WorkoutType, string> = {
  easy: 'Easy Run',
  long: 'Long Run',
  recovery: 'Recovery Run',
  tempo: 'Tempo Run',
  interval: 'Interval Run',
  shakeout: 'Shakeout Run',
  race: 'RACE!',
}

function formatMiles(distanceMiles: number): string {
  return String(Math.round(distanceMiles * 10) / 10)
}

export function workoutSummary(workout: Workout): string {
  const label = WORKOUT_LABELS[workout.type]
  return workout.distanceMiles === undefined
    ? label
    : `${label} - ${formatMiles(workout.distanceMiles)}`
}

export function formatPaceBand(band: PaceBand): string {
  const min = formatPace(band.minSecondsPerMile)
  const max = formatPace(band.maxSecondsPerMile)
  return min === max ? `${min} /mi` : `${min}-${max} /mi`
}

function workoutDescription(workout: Workout, week: PlanWeek, totalWeeks: number): string {
  const parts = []
  if (workout.distanceMiles !== undefined) {
    parts.push(`Distance: ${formatMiles(workout.distanceMiles)} miles`)
  }
  if (workout.paceBand !== undefined) {
    parts.push(`Pace: ${formatPaceBand(workout.paceBand)}`)
  }
  parts.push(`Week ${week.index + 1} of ${totalWeeks} - ${week.phase}`)
  return parts.join('\\n')
}

function compactDate(isoDate: string): string {
  return isoDate.replaceAll('-', '')
}

export function planToIcs(plan: TrainingPlan): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ravrun//Training Plan//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:ravrun training plan',
  ]
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.workout === undefined) continue
      const nextDay = format(addDays(parseISO(day.date), 1), 'yyyy-MM-dd')
      lines.push(
        'BEGIN:VEVENT',
        `UID:ravrun-${day.date}-${day.workout.type}@ravrun.com`,
        `DTSTAMP:${compactDate(plan.startDate)}T000000Z`,
        `DTSTART;VALUE=DATE:${compactDate(day.date)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDay)}`,
        `SUMMARY:${workoutSummary(day.workout)}`,
        `DESCRIPTION:${workoutDescription(day.workout, week, plan.weeks.length)}`,
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
