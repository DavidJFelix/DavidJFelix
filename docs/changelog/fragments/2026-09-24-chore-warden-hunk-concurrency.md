### chore(warden): review twenty hunks at once, at medium effort, ten turns each

This PR's diff had its Warden check cancelled twice at `ci-warden.yml`'s 20-minute cap, on the push
and on a label re-run, with the same shape both times: the security-review skill finished in 12 to
19 minutes with only low findings, and the code-review skill had reached 8 or 9 of the 24 files when
the runner stopped the job. Warden runs both skills' hunks through one queue, five wide by default,
so the code-review's hunks waited behind the security-review's, and a run at high effort needs 60 to
165 worker-minutes of hunk time in all, which five workers cannot fit into twenty minutes.
`warden.toml` now sets `[runner] concurrency = 20`, the key the action reads for that queue (its
`parallel` input is the fallback). The first run at that width fit the cap by three seconds, and its
slowest hunks were the story: at high effort single hunks ran for up to eighteen minutes, the same
hunk taking four to seven times longer than in the five-wide runs at only twice the cost, so the
model was reasoning at length on every turn of a long exploration. The cap stays where it is, since
a review that needs more is a review to make cheaper, and two dials do that:
`[defaults.agent] effort` goes from `high` to `medium`, the setting the config already named as the
first to turn back down, and `maxTurns = 10` (the runtime allows 50) cuts short a hunk that has not
settled after that many round trips. Medium effort brought the security-review of the whole diff to
four minutes, but at 25 turns three code-review hunks still ran for 13 to 14 minutes apiece, a
16-line route file among them, while the hunks that settled did so in one to five turns: the long
ones are exploration, not reading, and ten turns is where it stops. The six findings this diff drew
at high effort were all plain to a medium read. One ceiling remains on the width, the OpenRouter
credit balance: every in-flight request reserves its worst-case cost up front, a request the balance
cannot cover is refused, and Warden counts the refusal as a provider failure and stops the run after
five in a row, which is how two runs ended within minutes once the balance ran low. The balance is
topped up and the width is back at twenty; turn it down before the balance runs low again. Spend is
per token, so the width moves wall time only, and the effort and turn cap move both.
