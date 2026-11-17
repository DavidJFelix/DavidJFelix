### feat(revision.city): run OpenCode in a Durable Object

The revision.city app now builds a second Worker, `revision-city-reviewer`. It is the first step of
the move from the review tool loop to a coding harness. Its `ReviewAgent` Durable Object runs
OpenCode through the Cloudflare Agents SDK (`agents/harness/opencode`). OpenCode keeps its sessions
in the SQLite database of the object and calls DeepSeek V4.1 Flash on OpenRouter. `ReviewAgent.ask`
sends one prompt in a new session and returns the answer with the tokens and the cost of the model
calls.

The second Worker has its own config, `wrangler.reviewer.jsonc`, and `vite build` makes it together
with the app (the `auxiliaryWorkers` option of the Cloudflare vite plugin). It has no public host:
no route, no workers.dev host, and no preview URLs. revision.city will call the Durable Object
through a binding in a later change, and no review uses the harness yet.

The harness is not in the `revision-city` Worker. The Workers runtime parses each module of a Worker
when the Worker starts, also a module that no code imports. OpenCode adds 23 MiB, and a dynamic
import does not prevent the parse. In a local measurement, the `revision-city` Worker with OpenCode
parsed for about 555 ms at each start. Without OpenCode, it parses for about 190 ms.

The deploy registry (`bin/plan-affected-apps.ts`) has a new field, `auxiliaryWorkers`. A production
deploy of an app ships each auxiliary Worker as its own matrix entry, from the config that the build
writes. A preview and the dev worker have no auxiliary Worker.

The model provider is the OpenRouter provider of OpenCode, not the provider of the Agents SDK
(`agents/models/opencode`). The latter needs a package that OpenCode included only until 2.2.0. That
version of OpenCode does not build with the `effect` version of this workspace. OpenCode loads on
the first prompt. An import at the top of the module runs all of OpenCode when the Worker starts:
about 250 ms of the 1 second that Cloudflare allows.

The smoke gate of the app has a second script, `bin/smoke-review-agent.ts`. It starts the built
reviewer Worker in workerd and sends one prompt through OpenCode to a local server that answers in
place of OpenRouter. It fails if the answer, the usage, or the number of model calls is wrong. The
model calls in production need one manual step: the `OPENROUTER_API_KEY` secret on the new Worker.
Without the secret, `ask` returns the status `unanswered`.

The app declares `@opentelemetry/sdk-trace-node`, which it does not import. Without the direct
dependency, bun 1.4.4 stops with a panic when an install must download that package, as in CI.

The spell checker has a new topic dictionary for company names that the bundled `companies`
dictionary lacks: `.config/dictionaries/companies-extra.txt`. It holds `deepseek`, and the spelling
guide names it.
