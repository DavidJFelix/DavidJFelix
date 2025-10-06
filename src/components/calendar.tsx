import type {Interval} from 'date-fns'
import {eachDayOfInterval} from 'date-fns/eachDayOfInterval'
import {eachMonthOfInterval} from 'date-fns/eachMonthOfInterval'
import {subDays} from 'date-fns/subDays'
import Holidays from 'date-holidays'
import {type ReactNode, useId} from 'react'

import {css, cx} from '../../styled-system/css'

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

type DayFeature = WeekendFeature | HolidayFeature | PlanningFeature

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
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
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

  const gridCellClass = css({
    display: 'flex',
    aspectRatio: '1',
    padding: '1',
    justifyContent: 'center',
    alignItems: 'center',
  })

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid',
        borderColor: 'stone.300',
        backgroundColor: 'stone.50',
        padding: '16px',
        alignSelf: 'stretch',
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
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          gap: '2',
          width: '100%',
        })}
      >
        {weekDayHeaders.map((dayHeader) => (
          <div
            key={dayHeader}
            className={cx(
              css({
                fontWeight: '600',
                color: 'stone.700',
              }),
              gridCellClass,
            )}
          >
            {dayHeader}
          </div>
        ))}
        {slottedDays.map((day) => (
          <div
            key={getDayKey({id, dayIndex: day.index})}
            className={cx(
              css({
                border: '1px solid transparent',
                color: 'stone.700',
              }),
              gridCellClass,
              day.type === 'day' &&
                css({
                  backgroundColor: 'white',
                  borderColor: 'stone.300',
                }),
              day.type === 'day' &&
                day.dayFeatures.some((feature) => feature.type === 'holiday') &&
                css({
                  backgroundColor: 'red.100',
                  borderColor: 'red.500',
                  color: 'red.950',
                }),
              day.type === 'day' &&
                day.dayFeatures.some((feature) => feature.type === 'weekend') &&
                css({
                  backgroundColor: 'stone.200',
                  borderColor: 'stone.300',
                  color: 'stone.950',
                }),
            )}
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
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
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

function getCalendarDisplayState(interval: Interval): MonthProps[] {
  const holidays = new Holidays('US')

  const days = eachDayOfInterval(interval)

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
      const dayFeatures: DayFeature[] = []
      if (holidays.isHoliday(day)) {
        dayFeatures.push(
          ...(holidays
            .getHolidays(day)
            .map((holiday) => ({type: 'holiday', name: holiday.name})) as HolidayFeature[]),
        )
      }
      if (day.getDay() === 0 || day.getDay() === 6) {
        dayFeatures.push({type: 'weekend'})
      }
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
