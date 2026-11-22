const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR

// The largest unit first, so the text names the largest whole unit that has passed.
const UNITS: ReadonlyArray<{unit: Intl.RelativeTimeFormatUnit; seconds: number}> = [
  {unit: 'year', seconds: 365 * SECONDS_PER_DAY},
  {unit: 'month', seconds: 30 * SECONDS_PER_DAY},
  {unit: 'day', seconds: SECONDS_PER_DAY},
  {unit: 'hour', seconds: SECONDS_PER_HOUR},
  {unit: 'minute', seconds: SECONDS_PER_MINUTE},
]

export interface FormatRelativeTimeParams {
  // An ISO 8601 time.
  time: string | undefined
  // The current time in milliseconds since the epoch.
  now: number
  // A BCP 47 language tag. Without one, the runtime picks the language.
  locale?: string
}

// Says how long ago `time` was, such as "3 hours ago" or "yesterday". Answers undefined when
// `time` is missing or is not a time.
export function formatRelativeTime({
  time,
  now,
  locale,
}: FormatRelativeTimeParams): string | undefined {
  const then = time === undefined ? Number.NaN : Date.parse(time)
  if (Number.isNaN(then)) {
    return undefined
  }
  // A time after `now` comes from a clock that is ahead of this one, so it reads as now.
  const elapsedSeconds = Math.max(0, Math.floor((now - then) / 1000))
  const format = new Intl.RelativeTimeFormat(locale, {numeric: 'auto'})
  const match = UNITS.find(({seconds}) => elapsedSeconds >= seconds)
  return match === undefined
    ? format.format(-elapsedSeconds, 'second')
    : format.format(-Math.floor(elapsedSeconds / match.seconds), match.unit)
}
