import {expect, test} from 'vitest'
import {RACE_DISTANCE_MILES} from './constants'
import {formatDuration, formatPace, parseDuration, predictRaceTime, trainingPaces} from './paces'

// Riegel: t2 = t1 * (d2/d1)^1.06. A 25:00 5K predicts ~3:59:47 for the
// marathon (14387s) — the classic "25-minute 5K ≈ 4-hour marathon" rule.
test('predicts a marathon time from a recent 5K via Riegel', () => {
  const predicted = predictRaceTime(
    {distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds: 25 * 60},
    RACE_DISTANCE_MILES.marathon,
  )
  expect(predicted).toBeCloseTo(14387, -1)
})

// Easy pace = predicted marathon pace + 75s/mi, presented as a band whose
// fast end is that value. For a 25:00 5K: predicted marathon ~548.7s/mi,
// so easy is ~624-656 s/mi (10:24-10:56). Changing the offset or band-width
// constants should consciously break this anchor.
test('derives the easy pace band from a recent 5K', () => {
  const paces = trainingPaces({distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds: 25 * 60})
  expect(paces.easy.minSecondsPerMile).toBeCloseTo(624, -1)
  expect(paces.easy.maxSecondsPerMile - paces.easy.minSecondsPerMile).toBe(32)
})

test('formats paces as m:ss per mile, rounding fractional seconds', () => {
  expect(formatPace(618)).toBe('10:18')
  expect(formatPace(548.7)).toBe('9:09')
  expect(formatPace(605)).toBe('10:05')
})

test('parses and formats race durations in h:mm:ss and m:ss notation', () => {
  expect(parseDuration('4:30:00')).toBe(16200)
  expect(parseDuration('25:00')).toBe(1500)
  expect(formatDuration(16200)).toBe('4:30:00')
  expect(formatDuration(1500)).toBe('25:00')
  expect(formatDuration(14387)).toBe('3:59:47')
})

// The intensity ordering must hold no matter how the offsets are tuned:
// intervals fastest, then tempo, then easy, then long, then recovery.
test('orders pace bands by intensity regardless of runner speed', () => {
  for (const timeSeconds of [17 * 60, 25 * 60, 35 * 60]) {
    const paces = trainingPaces({distanceMiles: RACE_DISTANCE_MILES.fiveK, timeSeconds})
    expect(paces.interval.minSecondsPerMile).toBeLessThan(paces.tempo.minSecondsPerMile)
    expect(paces.tempo.minSecondsPerMile).toBeLessThan(paces.easy.minSecondsPerMile)
    expect(paces.easy.minSecondsPerMile).toBeLessThan(paces.long.minSecondsPerMile)
    expect(paces.long.minSecondsPerMile).toBeLessThan(paces.recovery.minSecondsPerMile)
  }
})
