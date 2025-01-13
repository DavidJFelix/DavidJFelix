import {createFileRoute} from '@tanstack/react-router'
import {addDays} from 'date-fns'
import type {ReactNode} from 'react'

interface ProgramConfiguration {
  // FIXME: maybe just use start and end dates?
  durationWeeks: number
  targetDistanceMiles: number
  targetRacePaceSecondsPerMile?: number
  startingDistanceMilesPerWeek?: number
  startingCasualPaceSecondsPerMile?: number
  startingThresholdPaceSecondsPerMile?: number
}

interface Workout {
  description: string
  distanceMiles?: number
  durationMinutes?: number
  paceSecondsPerMile?: number
}

interface ProgramDay {
  id: string
  workouts: Workout[]
}

interface ProgramWeek {
  id: string
  days: ProgramDay[]
}

interface ProgramSchedule {
  id: string
  weeks: ProgramWeek[]
}

const demoConfiguration: ProgramConfiguration = {
  durationWeeks: 18,
  targetDistanceMiles: 26.2,
  startingCasualPaceSecondsPerMile: 630, // 10:30
  startingThresholdPaceSecondsPerMile: 580, // 9:40
  startingDistanceMilesPerWeek: 20,
}

function generateSchedule(config: ProgramConfiguration): ProgramSchedule {
  return {
    id: crypto.randomUUID(),
    weeks: Array.from({length: config.durationWeeks}, (_, weekNumber) => {
      const crossTrainingMinuteIncrements = [30, 40, 50, 60]
      const shortRunDistanceMileIncrements = [3, 4, 5]
      const longWeekRunDistanceMileIncrements = [5, 6, 7, 8]

      const percentComplete = (weekNumber + 1) / config.durationWeeks
      const crossTrainingMinutesIndex = Math.floor(
        percentComplete * (crossTrainingMinuteIncrements.length - 1),
      )
      const shortRunDistanceMilesIndex = Math.floor(
        percentComplete * (shortRunDistanceMileIncrements.length - 1),
      )
      const longWeekRunDistanceMilesIndex = Math.floor(
        percentComplete * (longWeekRunDistanceMileIncrements.length - 1),
      )

      const crossTrainingDurationMinutes = crossTrainingMinuteIncrements[crossTrainingMinutesIndex]
      const shortRunDistanceMiles = shortRunDistanceMileIncrements[shortRunDistanceMilesIndex]
      const longWeekRunDistanceMiles =
        longWeekRunDistanceMileIncrements[longWeekRunDistanceMilesIndex]
      return {
        id: crypto.randomUUID(),
        days: [
          {
            id: crypto.randomUUID(),
            workouts: [
              {
                description: `${crossTrainingDurationMinutes} Minute Cross Training`,
                durationMinutes: crossTrainingDurationMinutes,
              },
            ],
          },
          {
            id: crypto.randomUUID(),
            workouts: [
              {
                description: `${shortRunDistanceMiles} Mile Easy Run`,
                distanceMiles: shortRunDistanceMiles,
              },
            ],
          },
          {
            id: crypto.randomUUID(),
            workouts: [
              {
                description: `${longWeekRunDistanceMiles} Mile Easy Run`,
                distanceMiles: longWeekRunDistanceMiles,
              },
            ],
          },
          {
            id: crypto.randomUUID(),
            workouts: [
              {
                description: `${shortRunDistanceMiles} Mile Easy Run`,
                distanceMiles: shortRunDistanceMiles,
              },
            ],
          },
          {
            id: crypto.randomUUID(),
            workouts: [],
          },
          {
            id: crypto.randomUUID(),
            workouts: [
              {
                description: `${longWeekRunDistanceMiles} Mile Easy Run`,
                distanceMiles: longWeekRunDistanceMiles,
              },
            ],
          },
          {
            id: crypto.randomUUID(),
            workouts: [
              {
                description: `${longWeekRunDistanceMiles} Mile Easy Run`,
                distanceMiles: longWeekRunDistanceMiles,
              },
            ],
          },
        ],
      }
    }),
  }
}

const demoSchedule = generateSchedule(demoConfiguration)

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return <ProgramCalendar />
}

interface DayProps {
  children?: ReactNode
  date: Date
  programDay: ProgramDay
}

function Day({children, date}: DayProps) {
  const dayName = new Intl.DateTimeFormat('en-US', {weekday: 'long', timeZone: '-0600'}).format(
    date,
  )
  const dayNumber = date.getDate()

  const bgColor = date.getMonth() % 2 === 0 ? 'bg-gray-800' : 'bg-purple-900'

  return (
    <div className={`p-2 border border-gray-200 rounded-lg ${bgColor}`}>
      {dayName} - {dayNumber}
      {children}
    </div>
  )
}

interface WeekProps {
  programIndex: number
  start: Date
  programWeek: ProgramWeek
}
function Week({programIndex, programWeek, start}: WeekProps) {
  const {id} = programWeek

  return (
    <>
      <div className='p-2 text-center'>Week {programIndex + 1}</div>
      {programWeek.days.map((programDay, i) => {
        const date = addDays(start, i)
        const {id: dayId} = programDay
        return (
          <Day key={`week-${id}/day-${dayId}`} date={date} programDay={programDay}>
            {programDay.workouts.map((workout) => (
              <p key={`day-${dayId}/workout-${workout.description}`}>{workout.description}</p>
            ))}
          </Day>
        )
      })}
    </>
  )
}

function ProgramCalendar() {
  const start = new Date('2024-12-23Z-0600')

  const {id} = demoSchedule
  return (
    <div className='p-2 grid grid-cols-8 gap-2'>
      {demoSchedule.weeks.map((programWeek, i) => {
        const weekStart = addDays(start, i * 7)
        const {id: weekId} = programWeek
        return (
          <Week
            start={weekStart}
            key={`program-${id}/week-${weekId}`}
            programIndex={i}
            programWeek={programWeek}
          />
        )
      })}
    </div>
  )
}
