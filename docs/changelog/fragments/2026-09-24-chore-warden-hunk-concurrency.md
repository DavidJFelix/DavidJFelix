### chore(warden): review twenty hunks at once

This PR's 24-file diff had its Warden check cancelled twice at `ci-warden.yml`'s 20-minute cap, on
the push and on a label re-run, with the same shape both times: the security-review skill finished
in 12 to 19 minutes with only low findings, and the code-review skill had reached 8 or 9 of the 24
files when the runner stopped the job. Warden runs both skills' hunks through one queue, five wide
by default, so the code-review's hunks waited behind the security-review's, and single hunks at high
effort ran anywhere from five seconds to fourteen minutes -- the same file varied by a factor of
twenty between the two runs. A run needs about 110 worker-minutes of hunk time in all, which five
workers cannot fit into twenty minutes. `warden.toml` now sets `[runner] concurrency = 20`, the key
the action reads for that queue (its `parallel` input is the fallback): a run then takes about as
long as its slowest hunk plus a minute or two, which resampling the observed durations puts under
eighteen minutes in all but a fraction of a percent of runs, and wider cannot help because the
slowest hunk sets the floor. Spend is per token, so the change moves wall time, not cost, and Warden
retries a rate-limited call before its circuit breaker counts a failure. The cap itself stays at
twenty minutes and is the next dial if a single hunk ever runs past it.
