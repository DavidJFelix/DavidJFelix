import type {Interval} from 'date-fns'
import {eachDayOfInterval} from 'date-fns/eachDayOfInterval'
import {eachMonthOfInterval} from 'date-fns/eachMonthOfInterval'
import {subDays} from 'date-fns/subDays'
import Holidays from 'date-holidays'
import {type ReactNode, useId} from 'react'

import {css, cva, cx} from '../../styled-system/css'
import {grid, hstack, stack, vstack} from '../../styled-system/patterns'

interface DayFeatureBase {
  type: string
}

interface WeekendFeature extends DayFeatureBase {
  type: 'weekend'
}

interface HolidayFeature extends DayFeatureBase {
  type: 'holiday'
  name: string
}

interface PlanningFeature extends DayFeatureBase {
  type: 'planning'
  name: string
}

interface ExecutionFeature extends DayFeatureBase {
  type: 'execution'
  name: string
}

interface HIPSprintFeature extends DayFeatureBase {
  type: 'hips-sprint'
  name: string
}

type DayFeature =
  | WeekendFeature
  | HolidayFeature
  | PlanningFeature
  | HIPSprintFeature
  | ExecutionFeature

interface GridSlot {
  type: string
  index: number
}

interface GridSpacer extends GridSlot {
  type: 'spacer'
}

interface GridDay extends GridSlot {
  type: 'day'
  date: Date
  dayFeatures: DayFeature[]
}

type DayDisplayState = GridDay | GridSpacer

interface CalendarDisplayProps {
  months: MonthProps[]
}

export function CalendarDisplay({months}: CalendarDisplayProps) {
  return (
    <div
      className={hstack({
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '4',
      })}
    >
      {months.map(({monthName, slottedDays}) => (
        <Month key={monthName} monthName={monthName} slottedDays={slottedDays} />
      ))}
    </div>
  )
}

interface MonthProps {
  monthName: string
  slottedDays: DayDisplayState[]
}
function Month({monthName, slottedDays}: MonthProps) {
  const id = useId()
  const weekDayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const gridCellBase = stack({
    aspectRatio: '1',
    padding: '1',
    alignItems: 'center',
  })

  const gridCellVariants = cva({
    base: {
      border: '1px solid transparent',
      color: 'stone.700',
    },
    variants: {
      cellType: {
        weekDayHeaders: {
          fontWeight: '600',
          color: 'stone.700',
        },
        day: {},
        spacer: {},
      },
      dayType: {
        normal: {},
        holiday: {
          backgroundColor: 'red.100',
          borderColor: 'red.500',
          color: 'red.950',
        },
        weekend: {
          backgroundColor: 'stone.200',
          borderColor: 'stone.300',
          color: 'stone.950',
        },
        planning: {
          backgroundColor: 'blue.100',
          borderColor: 'blue.500',
          color: 'blue.950',
        },
        execution: {
          backgroundColor: 'green.100',
          borderColor: 'green.500',
          color: 'green.950',
        },
        hipsSprint: {
          backgroundColor: 'purple.100',
          borderColor: 'purple.500',
          color: 'purple.950',
        },
      },
    },
    compoundVariants: [
      {
        cellType: 'day',
        dayType: 'normal',
        css: {
          backgroundColor: 'white',
          borderColor: 'stone.300',
        },
      },
    ],
    defaultVariants: {
      cellType: 'spacer',
      dayType: 'normal',
    },
  })

  type DayVariant = NonNullable<Parameters<typeof gridCellVariants>[0]>

  function getDayVariant(day: DayDisplayState): DayVariant {
    if (day.type === 'day') {
      let dayType: DayVariant['dayType'] = 'normal'
      if (day.dayFeatures.some((feature) => feature.type === 'holiday')) {
        dayType = 'holiday'
        return {cellType: day.type, dayType}
      }
      if (day.dayFeatures.some((feature) => feature.type === 'weekend')) {
        dayType = 'weekend'
        return {cellType: day.type, dayType}
      }
      if (day.dayFeatures.some((feature) => feature.type === 'planning')) {
        dayType = 'planning'
        return {cellType: day.type, dayType}
      }
      if (day.dayFeatures.some((feature) => feature.type === 'execution')) {
        dayType = 'execution'
        return {cellType: day.type, dayType}
      }
      return {cellType: day.type, dayType}
    }
    return {cellType: day.type, dayType: 'normal'}
  }

  return (
    <div
      className={vstack({
        gap: '4',
        alignSelf: 'stretch',
        padding: '4',
        border: '1px solid',
        borderColor: 'stone.300',
        backgroundColor: 'stone.50',
      })}
    >
      <h2
        className={css({
          fontSize: 'xl',
          fontWeight: '700',
          fontFamily: 'Roboto, sans-serif',
          color: 'red.700',
        })}
      >
        {monthName}
      </h2>
      <div
        className={grid({
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          gap: '2',
          width: '100%',
        })}
      >
        {weekDayHeaders.map((dayHeader) => (
          <div
            key={dayHeader}
            className={cx(gridCellVariants({cellType: 'weekDayHeaders'}), gridCellBase)}
          >
            {dayHeader}
          </div>
        ))}
        {slottedDays.map((day) => (
          <div
            key={getDayKey({id, dayIndex: day.index})}
            className={cx(gridCellVariants(getDayVariant(day)), gridCellBase)}
          >
            {day.type === 'day' ? day.date.getDate() : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export const Calendar = () => {
  return (
    <div
      className={vstack({
        gap: '8',
        margin: '2',
      })}
    >
      <CalendarHeader>Calendar</CalendarHeader>
      <CalendarDisplay
        months={getCalendarDisplayState({
          start: new Date(2025, 0, 1),
          end: new Date(2025, 11, 31),
        })}
      />
    </div>
  )
}

interface CalendarHeaderProps {
  children: ReactNode
}

function CalendarHeader({children}: CalendarHeaderProps) {
  return (
    <h1
      className={css({
        fontSize: '4xl',
        fontWeight: '800',
        fontFamily: 'Roboto, sans-serif',
        color: 'stone.950',
      })}
    >
      {children}
    </h1>
  )
}

interface GetDayKeyParams {
  id: string
  dayIndex: number
}

function getDayKey({id, dayIndex}: GetDayKeyParams) {
  return `${id}-day-${dayIndex}`
}

function getDaysMap(days: Date[]): Record<string, DayFeature[]> {
  // FIXME:CONSTANTS MOVE ELSEWHERE
  const PLANNING_WEEKDAY_COUNT = 10
  const EXECUTION_WEEKDAY_COUNT = 60

  const holidays = new Holidays('US', {types: ['bank', 'public', 'school']})
  const daysEntries: [string, DayFeature[]][] = []

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    const dayFeatures: DayFeature[] = []
    if (holidays.isHoliday(day)) {
      dayFeatures.push({type: 'holiday', name: holidays.getHolidays(day)[0].name})
    }
  }

  return Object.fromEntries(daysEntries)
}

function getCalendarDisplayState(interval: Interval): MonthProps[] {
  const holidays = new Holidays('US', {types: ['bank', 'public', 'school']})

  const days = eachDayOfInterval(interval)
  const daysMap: Record<string, DayFeature[]> = Object.fromEntries(
    days.map((day) => {
      const isHoliday = holidays.isHoliday(day)
      const isWeekend = day.getDay() === 0 || day.getDay() === 6

      return [
        day.toISOString(),
        [
          ...(isHoliday
            ? (holidays
                .getHolidays(day)
                .map((holiday) => ({type: 'holiday', name: holiday.name})) as HolidayFeature[])
            : []),
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
