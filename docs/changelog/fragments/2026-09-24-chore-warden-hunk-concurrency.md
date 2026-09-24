### chore(warden): review twenty hunks at once, with a 30-minute cap

This PR's 27-file diff had its Warden check cancelled at `ci-warden.yml`'s 20-minute cap, twice.
Warden runs both skills' hunks through one queue, five wide by default, so the code-review's hunks
waited behind the security-review's, and a run at high effort needs 100 to 165 worker-minutes of
hunk time in all. `warden.toml` now sets `[runner] concurrency = 20`, the key the action reads for
that queue (its `parallel` input is the fallback), which brings a run down to roughly its slowest
hunk, and single hunks at high effort have run for up to eighteen minutes, so the cap on both Warden
jobs goes from 20 to 30 minutes. Effort stays at `high`: a medium review was tried and is not worth
running. One ceiling on the width is the OpenRouter credit balance, since every in-flight request
reserves its worst-case cost up front and a refused request counts toward Warden's circuit breaker,
which stops the run after five refusals in a row.
