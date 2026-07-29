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

function Month({monthName, slottedDays}: MonthState) {
  const id = useId()
  const weekDayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const gridCellBase = stack({
    padding: '1',
    alignItems: 'center',
    justifyContent: 'center',
  })

  const gridCellVariants = cva({
    base: {
      border: '1px solid transparent',
      color: 'text',
    },
    variants: {
      cellType: {
        weekDayHeaders: {
          fontWeight: '600',
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
          mx: '4',
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
