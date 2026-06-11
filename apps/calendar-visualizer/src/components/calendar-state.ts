import type {Interval} from 'date-fns'
import {eachDayOfInterval} from 'date-fns/eachDayOfInterval'
import {eachMonthOfInterval} from 'date-fns/eachMonthOfInterval'
import {format} from 'date-fns/format'
import {subDays} from 'date-fns/subDays'
import Holidays from 'date-holidays'

interface DayFeatureBase {
  type: string
}

export interface WeekendFeature extends DayFeatureBase {
  type: 'weekend'
}

export interface HolidayFeature extends DayFeatureBase {
  type: 'holiday'
  name: string
}

export interface PlanningFeature extends DayFeatureBase {
  type: 'planning'
  name: string
}

export interface ExecutionFeature extends DayFeatureBase {
  type: 'execution'
  name: string
}

export interface HIPSprintFeature extends DayFeatureBase {
  type: 'hips-sprint'
  name: string
}

export type DayFeature =
  | WeekendFeature
  | HolidayFeature
  | PlanningFeature
  | HIPSprintFeature
  | ExecutionFeature

interface GridSlot {
  type: string
  index: number
}

export interface GridSpacer extends GridSlot {
  type: 'spacer'
}

export interface GridDay extends GridSlot {
  type: 'day'
  date: Date
  dayFeatures: DayFeature[]
}

export type DayDisplayState = GridDay | GridSpacer

export interface MonthState {
  monthName: string
  slottedDays: DayDisplayState[]
}

export function getCalendarDisplayState(interval: Interval): MonthState[] {
  const holidays = new Holidays('US', {types: ['bank', 'public', 'school']})

  const days = eachDayOfInterval(interval)

  // Match holidays by calendar date, not by instant: date-holidays computes
  // holiday ranges in the country's timezone, so probing with local-midnight
  // Date objects (isHoliday) shifts holidays onto the wrong day for any
  // machine east of the US (including UTC CI runners).
  const holidaysByDay = new Map<string, HolidayFeature[]>()
  const years = new Set(days.map((day) => day.getFullYear()))
  for (const year of years) {
    for (const holiday of holidays.getHolidays(year)) {
      const key = holiday.date.slice(0, 10)
      const features = holidaysByDay.get(key) ?? []
      features.push({type: 'holiday', name: holiday.name})
      holidaysByDay.set(key, features)
    }
  }

  const daysMap: Record<string, DayFeature[]> = Object.fromEntries(
    days.map((day) => {
      const isWeekend = day.getDay() === 0 || day.getDay() === 6

      return [
        day.toISOString(),
        [
          ...(holidaysByDay.get(format(day, 'yyyy-MM-dd')) ?? []),
          ...(isWeekend ? ([{type: 'weekend'}] as WeekendFeature[]) : []),
        ],
      ]
    }),
  )

  const months = eachMonthOfInterval(interval).map((month, monthIndex, months) => {
    const slottedDays: DayDisplayState[] = []
    let start: Date
    let end: Date
    if (monthIndex === 0) {
      start = interval.start as Date
    } else {
      start = month
    }
    if (monthIndex === months.length - 1) {
      end = interval.end as Date
    } else {
      end = subDays(months[monthIndex + 1], 1)
    }

    eachDayOfInterval({
      start,
      end,
    }).forEach((day) => {
      const dayColumn = day.getDay()
      while (slottedDays.length < dayColumn) {
        slottedDays.push({index: slottedDays.length, type: 'spacer'})
      }
      const dayFeatures: DayFeature[] = daysMap[day.toISOString()] ?? []

      slottedDays.push({
        index: slottedDays.length,
        type: 'day',
        date: day,
        dayFeatures,
      })
    })

    return {
      monthName: month.toLocaleString('en-US', {month: 'long'}),
      slottedDays,
    }
  })

  return months
}
