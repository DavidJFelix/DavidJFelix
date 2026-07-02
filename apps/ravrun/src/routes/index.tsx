import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {addDays, format, parseISO} from 'date-fns'
import {DEFAULT_DURATION_WEEKS, RACE_DISTANCE_MILES} from '../lib/plan/constants'
import type {Finding} from '../lib/plan/feasibility'
import {assessFeasibility} from '../lib/plan/feasibility'
import type {
  PlanDay,
  PlanRequest,
  PlanWeek,
  RaceDistance,
  TrainingPlan,
  WorkoutType,
} from '../lib/plan/generate'
import {generatePlan} from '../lib/plan/generate'
import {formatPaceBand, planToIcs, workoutSummary} from '../lib/plan/ics'
import type {RaceResult} from '../lib/plan/paces'
import {parseDuration} from '../lib/plan/paces'

const DISTANCE_LABELS: Record<RaceDistance, string> = {
  fiveK: '5K',
  tenK: '10K',
  half: 'Half Marathon',
  marathon: 'Marathon',
}

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

// Search params are the source of truth for the plan config, so every plan
// is a shareable URL. `today` exists so tests can pin feasibility output.
interface PlanSearch {
  dist?: RaceDistance
  race?: string
  goal?: string
  wm?: number
  weeks?: number
  rd?: RaceDistance
  rt?: string
  lrd?: number
  today?: string
}

function asDistance(value: unknown): RaceDistance | undefined {
  return typeof value === 'string' && value in RACE_DISTANCE_MILES
    ? (value as RaceDistance)
    : undefined
}

function asIsoDate(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function asDurationText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function durationSeconds(text: string | undefined): number | undefined {
  if (text === undefined) return undefined
  const seconds = parseDuration(text)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): PlanSearch => ({
    dist: asDistance(search.dist),
    race: asIsoDate(search.race),
    goal: asDurationText(search.goal),
    wm: asNumber(search.wm),
    weeks: asNumber(search.weeks),
    rd: asDistance(search.rd),
    rt: asDurationText(search.rt),
    lrd: asNumber(search.lrd),
    today: asIsoDate(search.today),
  }),
  component: HomeComponent,
})

interface ResolvedConfig {
  distance: RaceDistance
  raceDate: string
  goalTimeSeconds: number | undefined
  weeklyMileage: number
  durationWeeks: number
  recentRace: RaceResult | undefined
  longRunDay: number
  today: string
}

function resolveConfig(search: PlanSearch): ResolvedConfig {
  const distance = search.dist ?? 'marathon'
  const durationWeeks = Math.min(
    52,
    Math.max(4, Math.round(search.weeks ?? DEFAULT_DURATION_WEEKS[distance])),
  )
  const today = search.today ?? format(new Date(), 'yyyy-MM-dd')
  const recentTimeSeconds = durationSeconds(search.rt)
  return {
    distance,
    durationWeeks,
    today,
    raceDate: search.race ?? format(addDays(parseISO(today), durationWeeks * 7), 'yyyy-MM-dd'),
    goalTimeSeconds: durationSeconds(search.goal),
    weeklyMileage: Math.max(1, search.wm ?? 20),
    recentRace:
      search.rd !== undefined && recentTimeSeconds !== undefined
        ? {distanceMiles: RACE_DISTANCE_MILES[search.rd], timeSeconds: recentTimeSeconds}
        : undefined,
    longRunDay: Math.min(6, Math.max(0, Math.round(search.lrd ?? 6))),
  }
}

function HomeComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate({from: Route.fullPath})
  const config = resolveConfig(search)
  const request: PlanRequest = {
    race: {
      distance: config.distance,
      date: config.raceDate,
      goalTimeSeconds: config.goalTimeSeconds,
    },
    runner: {
      weeklyMileage: config.weeklyMileage,
      recentRace: config.recentRace,
      longRunDay: config.longRunDay,
    },
    durationWeeks: config.durationWeeks,
  }
  const plan = generatePlan(request)
  const findings = assessFeasibility(request, {today: config.today})

  const updateSearch = (patch: Partial<PlanSearch>) => {
    navigate({search: (previous) => ({...previous, ...patch}), replace: true})
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <PlanForm config={config} search={search} onChange={updateSearch} />
      <FindingsList findings={findings} onUseSuggestedWeeks={(weeks) => updateSearch({weeks})} />
      <PlanToolbar plan={plan} />
      <PlanGrid plan={plan} />
    </main>
  )
}

interface PlanFormProps {
  config: ResolvedConfig
  search: PlanSearch
  onChange: (patch: Partial<PlanSearch>) => void
}

const FIELD_CLASS =
  'rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1'

function PlanForm({config, search, onChange}: PlanFormProps) {
  return (
    <form
      className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-sm">
        Race
        <select
          className={FIELD_CLASS}
          value={config.distance}
          onChange={(event) =>
            onChange({dist: event.target.value as RaceDistance, weeks: undefined})
          }
        >
          {(Object.keys(RACE_DISTANCE_MILES) as RaceDistance[]).map((distance) => (
            <option key={distance} value={distance}>
              {DISTANCE_LABELS[distance]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Race date
        <input
          type="date"
          className={FIELD_CLASS}
          value={config.raceDate}
          onChange={(event) => onChange({race: event.target.value || undefined})}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Goal time
        <input
          type="text"
          className={FIELD_CLASS}
          placeholder="4:30:00"
          value={search.goal ?? ''}
          onChange={(event) => onChange({goal: event.target.value || undefined})}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Plan length (weeks)
        <input
          type="number"
          min={4}
          max={52}
          className={FIELD_CLASS}
          value={config.durationWeeks}
          onChange={(event) => onChange({weeks: asNumber(event.target.value)})}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Current weekly mileage
        <input
          type="number"
          min={1}
          className={FIELD_CLASS}
          value={config.weeklyMileage}
          onChange={(event) => onChange({wm: asNumber(event.target.value)})}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Recent race
        <select
          className={FIELD_CLASS}
          value={search.rd ?? ''}
          onChange={(event) => onChange({rd: asDistance(event.target.value)})}
        >
          <option value="">None</option>
          {(Object.keys(RACE_DISTANCE_MILES) as RaceDistance[]).map((distance) => (
            <option key={distance} value={distance}>
              {DISTANCE_LABELS[distance]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Recent race time
        <input
          type="text"
          className={FIELD_CLASS}
          placeholder="25:00"
          value={search.rt ?? ''}
          onChange={(event) => onChange({rt: event.target.value || undefined})}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Long run day
        <select
          className={FIELD_CLASS}
          value={config.longRunDay}
          onChange={(event) => onChange({lrd: asNumber(event.target.value)})}
        >
          {WEEKDAY_LABELS.map((label, weekday) => (
            <option key={label} value={weekday}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}

const FINDING_STYLES: Record<Finding['level'], string> = {
  info: 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  warning: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  danger: 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

interface FindingsListProps {
  findings: Finding[]
  onUseSuggestedWeeks: (weeks: number) => void
}

function FindingsList({findings, onUseSuggestedWeeks}: FindingsListProps) {
  if (findings.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {findings.map((finding) => (
        <div
          key={finding.code}
          className={`border-l-4 rounded px-3 py-2 text-sm flex items-center gap-3 ${FINDING_STYLES[finding.level]}`}
        >
          <span className="grow">{finding.message}</span>
          {finding.suggestedWeeks !== undefined && (
            <button
              type="button"
              className="shrink-0 rounded border border-current px-2 py-1"
              onClick={() => onUseSuggestedWeeks(finding.suggestedWeeks ?? 0)}
            >
              Use {finding.suggestedWeeks} weeks
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function PlanToolbar({plan}: {plan: TrainingPlan}) {
  const totalMiles = Math.round(plan.weeks.reduce((sum, week) => sum + week.totalMiles, 0))
  const downloadIcs = () => {
    const blob = new Blob([planToIcs(plan)], {type: 'text/calendar'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'ravrun-plan.ics'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span>
        {plan.startDate} → {plan.raceDate} · {plan.weeks.length} weeks · ~{totalMiles} miles total
      </span>
      <button
        type="button"
        className="rounded border border-gray-400 dark:border-gray-600 px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={downloadIcs}
      >
        Download .ics
      </button>
    </div>
  )
}

const WORKOUT_STYLES: Record<WorkoutType, string> = {
  easy: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  long: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  recovery: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  tempo: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  interval: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  shakeout: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
  race: 'bg-yellow-200 text-yellow-950 dark:bg-yellow-900 dark:text-yellow-100 font-bold',
}

const PHASE_STYLES: Record<PlanWeek['phase'], string> = {
  base: 'text-emerald-700 dark:text-emerald-400',
  build: 'text-amber-700 dark:text-amber-400',
  peak: 'text-rose-700 dark:text-rose-400',
  taper: 'text-sky-700 dark:text-sky-400',
  race: 'text-yellow-700 dark:text-yellow-400',
}

function PlanGrid({plan}: {plan: TrainingPlan}) {
  const headerDates = plan.weeks[0]?.days ?? []
  return (
    <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-xs">
      <div />
      {headerDates.map((day) => (
        <div key={day.date} className="p-1 text-center font-semibold">
          {format(parseISO(day.date), 'EEE')}
        </div>
      ))}
      {plan.weeks.map((week) => (
        <WeekRow key={week.index} week={week} />
      ))}
    </div>
  )
}

function WeekRow({week}: {week: PlanWeek}) {
  return (
    <>
      <div className="p-2 pr-3 text-right">
        <div className="font-semibold text-sm">Week {week.index + 1}</div>
        <div className={`capitalize ${PHASE_STYLES[week.phase]}`}>
          {week.phase}
          {week.isStepback ? ' · stepback' : ''}
        </div>
        <div className="text-gray-500 dark:text-gray-400">{Math.round(week.totalMiles)} mi</div>
      </div>
      {week.days.map((day) => (
        <DayCell key={day.date} day={day} />
      ))}
    </>
  )
}

function DayCell({day}: {day: PlanDay}) {
  const date = parseISO(day.date)
  return (
    <div className="p-1 rounded border border-gray-200 dark:border-gray-800 flex flex-col gap-1 min-h-16">
      <span className="text-gray-500 dark:text-gray-400">{format(date, 'MMM d')}</span>
      {day.workout ? (
        <span className={`rounded px-1 py-0.5 ${WORKOUT_STYLES[day.workout.type]}`}>
          {workoutSummary(day.workout)}
          {day.workout.paceBand && (
            <span className="block opacity-80">{formatPaceBand(day.workout.paceBand)}</span>
          )}
        </span>
      ) : (
        <span className="text-gray-400 dark:text-gray-600">Rest</span>
      )}
    </div>
  )
}
