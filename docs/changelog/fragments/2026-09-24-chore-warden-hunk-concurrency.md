### chore(warden): review twenty hunks at once, at medium effort

This PR's diff had its Warden check cancelled twice at `ci-warden.yml`'s 20-minute cap, on the push
and on a label re-run, with the same shape both times: the security-review skill finished in 12 to
19 minutes with only low findings, and the code-review skill had reached 8 or 9 of the 24 files when
the runner stopped the job. Warden runs both skills' hunks through one queue, five wide by default,
so the code-review's hunks waited behind the security-review's, and a run needs 60 to 165
worker-minutes of hunk time in all, which five workers cannot fit into twenty minutes. `warden.toml`
now sets `[runner] concurrency = 20`, the key the action reads for that queue (its `parallel` input
is the fallback), so a run takes about as long as its slowest hunk plus a minute or two, and wider
cannot help because the slowest hunk sets the floor. The first run at that width fit the cap by
three seconds, and its slowest hunks were the story: at high effort single hunks ran for up to
eighteen minutes, the same hunk taking four to seven times longer than in the five-wide runs at only
twice the cost, so the model was reasoning at length on every turn of a long exploration. The cap
stays where it is, since a review that needs more is a review to make cheaper, and two dials do
that: `[defaults.agent] effort` goes from `high` to `medium`, the setting the config already named
as the first to turn back down, and `maxTurns = 25` (the runtime allows 50) cuts short a hunk that
has not settled after that many round trips; the six findings this diff drew at high effort were all
plain to a medium read. Spend is per token, so the concurrency moves wall time only, and the effort
moves both.
