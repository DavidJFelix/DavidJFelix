### fix(tooling): gate the f311x preview smoke behind the edge readiness loop

The f311x preview workflow is the one preview pipeline not built on the shared preview actions
(alchemy owns its deploy), so it never inherited the `bin/await-url-ready.ts` gate those actions run
between deploy and smoke -- it went straight to smoke with four attempts over twenty seconds, under
a comment claiming workers.dev is live immediately. PR #364 disproved that comment: the stage's
first-ever deploy created a fresh worker whose newly enabled workers.dev hostname served 404s past
the whole retry budget, and a plain rerun (hostname propagated by then) passed.

The workflow now runs the same readiness gate as the shared actions between deploy and smoke --
sustained consecutive all-OK rounds against the exact URL smoke and screenshots fetch, bounded by
the gate's three-minute deadline -- and the disproven comment is replaced with the observed
behavior. Smoke keeps its short retries, which only need to cover transient blips once readiness is
proven.
