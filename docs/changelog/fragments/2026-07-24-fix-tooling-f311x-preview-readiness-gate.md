### fix(tooling): gate the f311x preview smoke behind the edge readiness loop

The f311x preview workflow is the one preview pipeline not built on the shared preview actions
(alchemy owns its deploy), so it never inherited the `bin/await-url-ready.ts` gate those actions run
between deploy and smoke -- it went straight to smoke with four attempts over twenty seconds, under
a comment claiming workers.dev is live immediately. PR #364 disproved that comment: the stage's
first-ever deploy created a fresh worker whose newly enabled workers.dev hostname served 404s past
the whole retry budget, and a plain rerun (hostname propagated by then) passed.

The workflow now runs the same readiness gate as the shared actions between deploy and smoke,
holding the fixed routes smoke and screenshots fetch -- the page and the chat endpoint, which
answers GET with the same routing smoke's POST exercises -- to sustained consecutive all-OK rounds
within the gate's three-minute deadline. Propagation converges per URL, and the gate's first outing
proved the page alone is not enough: with `/` sustained-ready, smoke still failed on its sibling
fetches. The one URL the gate cannot probe is the hashed client JS asset, named per build inside the
HTML, so smoke's all-or-nothing content chain widens from four attempts over twenty seconds to
twelve over a minute to ride out that last URL's convergence. The disproven "live immediately"
comment is replaced with the observed behavior.
