// Every tunable training-rule number in the plan engine lives here, so a
// change of opinion (a longer peak long run, a gentler ramp) is a one-line
// edit with the test suite as the safety net.

export const RACE_DISTANCE_MILES = {
  fiveK: 3.106855,
  tenK: 6.21371,
  half: 13.109375,
  marathon: 26.21875,
} as const

export const DEFAULT_DURATION_WEEKS = {
  fiveK: 8,
  tenK: 10,
  half: 12,
  marathon: 18,
} as const

export const PLAN_RULES = {
  // Riegel fatigue exponent: t2 = t1 * (d2/d1)^exponent.
  riegelExponent: 1.06,

  // Fast end of each training pace band, in seconds per mile added to a
  // Riegel-predicted race pace: easy sits 75s over predicted marathon pace,
  // tempo 15s over predicted 10K pace, intervals at predicted 5K pace.
  // Long and recovery runs are offsets from the easy pace.
  easyOverMarathonPace: 75,
  tempoOverTenKPace: 15,
  longOverEasyPace: 15,
  recoveryOverEasyPace: 40,

  // Width of each pace band (slow end minus fast end), seconds per mile.
  paceBandWidthSeconds: {
    easy: 32,
    long: 24,
    recovery: 32,
    tempo: 16,
    interval: 16,
  },

  // Day-type rotation anchored on the long run: slot 0 is the long-run day,
  // slot 1 the day after, and so on around the week. 'quality' runs easy
  // during base and becomes an interval session from the build phase onward.
  // With a Saturday long run this yields Sun recovery, Mon rest, Tue tempo,
  // Wed easy, Thu quality, Fri easy — the same shape as David's 2026 plan.
  weekTemplate: ['long', 'recovery', 'rest', 'tempo', 'easy', 'quality', 'easy'],

  // 0 = Sunday ... 6 = Saturday.
  defaultLongRunDay: 6,

  // Race week winds down instead of following the rotation: a short shakeout
  // the day before, total rest two days out, and a few short easy runs
  // early in the week to maintain some volume.
  raceWeekEasyRunCount: 3,

  // Weeks of taper before race week, per distance.
  taperWeeks: {fiveK: 1, tenK: 1, half: 1, marathon: 2},

  // Every Nth week is a stepback (recovery) week at reduced volume, except
  // during taper and race weeks.
  stepbackEveryNthWeek: 4,
  stepbackVolumeFactor: 0.8,

  // Long-run progression: start from a fraction of current weekly mileage
  // (never below the floor), climb linearly across non-stepback weeks to the
  // distance-specific peak, which lands on the final week before taper.
  // David's 2026 plan peaks at 22 — bump peakLongRunMiles.marathon to taste.
  longRunStartFraction: 0.4,
  longRunFloorMiles: 6,
  peakLongRunMiles: {fiveK: 6, tenK: 8, half: 12, marathon: 20},

  // Taper long runs as fractions of the peak long run, week by week.
  taperLongRunFactors: [0.6, 0.4],

  // The long run carries this share of a week's volume (David's 2026 plan
  // holds ~0.40-0.42 throughout); the remainder spreads across the other
  // run days by slot, indexed like weekTemplate (long and rest get 0).
  longRunShareOfWeek: 0.42,
  remainderShareBySlot: [0, 0.19, 0, 0.24, 0.15, 0.24, 0.18],

  // Race-week easy runs as shares of peak weekly volume, plus the shakeout.
  raceWeekEasyShares: [0.15, 0.11, 0.09],
  shakeoutMiles: 2,

  // After removing taper and race week, the rest of the plan splits into
  // base / build / peak by these portions (peak takes the remainder).
  basePortion: 0.45,
  buildPortion: 0.3,

  // Feasibility: how far a goal may outrun the Riegel prediction from a
  // recent race before it earns a warning (aggressive) or danger (risk of
  // blowing up at the race).
  goalGapWarningFraction: 0.05,
  goalGapDangerFraction: 0.1,
  // ...and how far it may lag the prediction before a "you could aim
  // faster" nudge.
  goalGapConservativeFraction: 0.05,

  // Feasibility: weekly volume growth beyond this fraction between full
  // weeks risks injury; suggested alternatives are capped at a year out.
  weeklyRampCap: 0.1,
  maxSuggestedWeeks: 52,

  // Feasibility: shortest sensible block per distance.
  minDurationWeeks: {fiveK: 4, tenK: 6, half: 8, marathon: 12},
} as const
