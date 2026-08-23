import {type ReactNode, useId} from 'react'

import {css, cva, cx} from '../../styled-system/css'
import {grid, hstack, stack, vstack} from '../../styled-system/patterns'
import {type DayDisplayState, getCalendarDisplayState, type MonthState} from './calendar-state'

interface CalendarDisplayProps {
  months: MonthState[]
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

const monthGridCellVariants = cva({
  base: {
    border: '[1px solid transparent]',
    color: 'text',
  },
  variants: {
    cellType: {
      weekDayHeaders: {
        fontWeight: 'semibold',
        color: 'text',
      },
      day: {},
      spacer: {},
    },
    dayType: {
      normal: {},
      holiday: {
        backgroundColor: 'holiday.bg',
        borderColor: 'holiday.border',
        color: 'holiday.text',
      },
      weekend: {
        backgroundColor: 'weekend.bg',
        borderColor: 'border',
        color: 'weekend.text',
      },
      planning: {
        backgroundColor: 'planning.bg',
        borderColor: 'planning.border',
        color: 'planning.text',
      },
      execution: {
        backgroundColor: 'execution.bg',
        borderColor: 'execution.border',
        color: 'execution.text',
      },
      hipsSprint: {
        backgroundColor: 'hipsSprint.bg',
        borderColor: 'hipsSprint.border',
        color: 'hipsSprint.text',
      },
    },
  },
  compoundVariants: [
    {
      cellType: 'day',
      dayType: 'normal',
      css: {
        backgroundColor: 'day',
        borderColor: 'border',
      },
    },
  ],
  defaultVariants: {
    cellType: 'spacer',
    dayType: 'normal',
  },
})

type MonthGridCellVariant = NonNullable<Parameters<typeof monthGridCellVariants>[0]>

function getMonthGridCellVariant(day: DayDisplayState): MonthGridCellVariant {
  if (day.type === 'day') {
    let dayType: MonthGridCellVariant['dayType'] = 'normal'
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

const monthGridCellBase = stack({
  padding: '1',
  alignItems: 'center',
  justifyContent: 'center',
})

interface MonthNameHeaderProps {
  monthName: string
}
function MonthNameHeader({monthName}: MonthNameHeaderProps) {
  return (
    <h2
      className={css({
        fontSize: 'xl',
        fontWeight: 'bold',
        fontFamily: '[Roboto, sans-serif]',
        color: 'heading',
      })}
    >
      {monthName}
    </h2>
  )
}

function Month({monthName, slottedDays}: MonthState) {
  const id = useId()
  const weekDayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div
      className={vstack({
        gap: '4',
        alignSelf: 'stretch',
        padding: '4',
        border: '[1px solid]',
        borderColor: 'border',
        backgroundColor: 'canvas',
      })}
    >
      <MonthNameHeader monthName={monthName} />
      <div
        className={grid({
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          mx: '4',
          gap: '2',
          width: 'full',
        })}
      >
        {weekDayHeaders.map((dayHeader) => (
          <div
            key={dayHeader}
            className={cx(monthGridCellVariants({cellType: 'weekDayHeaders'}), monthGridCellBase)}
          >
            {dayHeader}
          </div>
        ))}
        {slottedDays.map((day) => (
          <div
            key={getDayKey({id, dayIndex: day.index})}
            className={cx(monthGridCellVariants(getMonthGridCellVariant(day)), monthGridCellBase)}
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
        fontWeight: 'extrabold',
        fontFamily: '[Roboto, sans-serif]',
        color: 'title',
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
