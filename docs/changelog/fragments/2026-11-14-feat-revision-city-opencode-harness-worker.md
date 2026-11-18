### feat(revision.city): run OpenCode in a Durable Object

A new Worker, `revision-city-harness-opencode`, is the first step of the move from the review tool
loop to a coding harness. Its `ReviewAgent` Durable Object runs OpenCode through the Cloudflare
Agents SDK (`agents/harness/opencode`). OpenCode keeps its sessions in the SQLite database of the
object and calls DeepSeek V4.1 Flash on OpenRouter. `ReviewAgent.ask` sends one prompt in a new
session and returns the answer with the tokens and the cost of the model calls.

The harness is in `workspaces/harnesses/opencode/`, which is an install root of its own. It has its
own `package.json` and its own `bun.lock`, and it is not a part of the web-apps workspace. More
harnesses are planned, and each one gets a directory in `workspaces/harnesses/`. Thus a harness does
not move the versions of another harness or of the apps. The `overrides` of the web-apps workspace
do not apply to it, so OpenCode gets the `effect` version that it pins.

The Worker has no public host: no route, no workers.dev host, and no preview URLs. revision.city
will call the Durable Object through a binding in a later change, and no review uses the harness
yet. A second reason to keep the harness out of the `revision-city` Worker is the start time. The
Workers runtime parses each module of a Worker when the Worker starts, also a module that no code
imports. OpenCode adds 23 MiB, and a dynamic import does not prevent the parse. In a local
measurement, the `revision-city` Worker with OpenCode parsed for about 555 ms at each start. Without
OpenCode, it parses for about 190 ms.

Two workflows are new. `ci-harnesses.yml` installs a harness from its lockfile and runs the
typecheck, the linters, the format check, the tests, a dry-run build, and the smoke test.
`cd-deploy-harnesses.yml` deploys the harness Workers after a push to `main` that changes
`workspaces/harnesses/` or the tool pins of the repo. The lint configs of a harness extend the
configs of the web-apps workspace, and the spell check now reads `workspaces/harnesses/`. A Renovate
rule puts the updates of the OpenCode harness in a PR of their own.

The model provider is the OpenRouter provider of OpenCode, not the provider of the Agents SDK
(`agents/models/opencode`). The latter needs a package that OpenCode included only until 2.2.0.
OpenCode loads on the first prompt. An import at the top of the module runs all of OpenCode when the
Worker starts: about 250 ms of the 1 second that Cloudflare allows.

The smoke test, `bin/smoke.ts`, starts the Worker in workerd and sends one prompt through OpenCode
to a local server that answers in place of OpenRouter. It fails if the answer, the usage, or the
number of model calls is wrong. The model calls in production need one manual step: the
`OPENROUTER_API_KEY` secret on the new Worker. Without the secret, `ask` returns the status
`unanswered`.

The spell checker has a new topic dictionary for company names that the bundled `companies`
dictionary lacks: `.config/dictionaries/companies-extra.txt`. It holds `deepseek`, and the spelling
guide names it.
