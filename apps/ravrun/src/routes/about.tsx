import {createFileRoute, Link} from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <main className="p-4 max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-bold">About ravrun</h1>
      <p>
        ravrun builds endurance training plans around one idea: a plan should challenge you and hold
        you accountable, without overtraining you or getting you hurt. Tell it your race, when it
        is, and where your fitness is today — it lays out the whole block, week by week.
      </p>

      <h2 className="text-lg font-semibold">How the plan is built</h2>
      <p>
        Everything anchors on race day and counts backward. The block moves through base, build,
        peak, and taper phases; every fourth week steps back to a lighter load so you absorb the
        training. The long run climbs steadily from what you can handle now toward a
        distance-appropriate peak, and the rest of each week rotates around whichever day you like
        to run long — tempo work midweek, intervals once you are past base, a recovery jog after the
        long run, and race week winds all the way down to a shakeout and the start line. These are
        the tried-and-true progressive-mileage rules used by classic marathon plans, encoded as
        rules rather than fixed tables so any distance and duration works.
      </p>

      <h2 className="text-lg font-semibold">Paces</h2>
      <p>
        Give it a recent race result and every run gets a pace band, derived with the standard
        Riegel prediction formula. If your goal is faster than your current fitness predicts, the
        bands tighten gradually across the block, meeting your goal fitness by race week.
      </p>

      <h2 className="text-lg font-semibold">Honesty checks</h2>
      <p>
        The plan tells you when the math does not add up: a goal well beyond what your recent race
        predicts, a mileage ramp steep enough to risk injury (with a suggestion for how many weeks
        you actually need), a block too short for the distance, or a start date that has already
        passed you by.
      </p>

      <h2 className="text-lg font-semibold">Take it with you</h2>
      <p>
        The whole configuration lives in the URL — copy the link and the plan goes with it. The .ics
        download drops every workout onto your calendar as an all-day event, paces included.
      </p>

      <p>
        <Link to="/" className="underline">
          Build your plan →
        </Link>
      </p>
    </main>
  )
}
