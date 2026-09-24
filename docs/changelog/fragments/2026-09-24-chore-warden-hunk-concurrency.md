### chore(warden): review eight hunks at once, at medium effort

This PR's diff had its Warden check cancelled twice at `ci-warden.yml`'s 20-minute cap, on the push
and on a label re-run, with the same shape both times: the security-review skill finished in 12 to
19 minutes with only low findings, and the code-review skill had reached 8 or 9 of the 24 files when
the runner stopped the job. Warden runs both skills' hunks through one queue, five wide by default,
so the code-review's hunks waited behind the security-review's, and a run at high effort needs 60 to
165 worker-minutes of hunk time in all, which five workers cannot fit into twenty minutes.
`warden.toml` now sets `[runner] concurrency`, the key the action reads for that queue (its
`parallel` input is the fallback). Twenty wide, a run fit the cap by three seconds, and its slowest
hunks were the story: at high effort single hunks ran for up to eighteen minutes, the same hunk
taking four to seven times longer than in the five-wide runs at only twice the cost, so the model
was reasoning at length on every turn of a long exploration. The cap stays where it is, since a
review that needs more is a review to make cheaper, and two dials do that: `[defaults.agent] effort`
goes from `high` to `medium`, the setting the config already named as the first to turn back down,
and `maxTurns = 25` (the runtime allows 50) cuts short a hunk that has not settled after that many
round trips. The six findings this diff drew at high effort were all plain to a medium read, and at
medium the hunks that ran took between twenty seconds and two minutes. The width settles at eight
rather than twenty because the ceiling is the OpenRouter credit balance, not the model: every
in-flight request reserves its worst-case cost up front, a request the balance cannot cover is
refused, and Warden counts the refusal as a provider failure and stops the run after five in a row,
which is how the first run at medium effort ended after two minutes. Twenty ran once and was refused
the next time; eight is what the balance carries with room to spare, and the balance is what to
raise before the width. Spend is per token, so the width moves wall time only, and the effort moves
both.
