### feat(revision-city-reviewer): run OpenCode in a Durable Object

A new Worker, `revision-city-reviewer`, is the first step of the move from the review tool loop in
revision.city to a coding harness. Its `ReviewAgent` Durable Object runs OpenCode through the
Cloudflare Agents SDK (`agents/harness/opencode`). OpenCode keeps its sessions in the SQLite
database of the object and calls DeepSeek V4.1 Flash on OpenRouter. `ReviewAgent.ask` sends one
prompt in a new session and returns the answer with the tokens and the cost of the model calls.

The Worker has no public host: no route, no workers.dev host, and no preview URLs. revision.city
will call the Durable Object through a binding in a later change, and no review uses the harness
yet. The harness is not in the revision.city Worker because OpenCode adds 23 MiB to a server bundle,
which doubles the bundle of revision.city.

The model provider is the OpenRouter provider of OpenCode, not the provider of the Agents SDK
(`agents/models/opencode`). The latter needs a package that OpenCode included only until 2.2.0. That
version of OpenCode does not build with the `effect` version of this workspace. OpenCode loads on
the first prompt. An import at the top of the module uses about 450 ms of the 1 second that
Cloudflare allows for the start of a Worker.

The smoke test starts the Worker in workerd and sends one prompt through OpenCode to a local server
that answers in place of OpenRouter. It fails if the answer, the usage, or the number of model calls
is wrong. The model calls in production need one manual step: the `OPENROUTER_API_KEY` secret on the
new Worker. Without the secret, `ask` returns the status `unanswered`.

The app declares `@opentelemetry/sdk-trace-node`, which it does not import. Without the direct
dependency, bun 1.4.4 stops with a panic when an install must download that package, as in CI.
`bunfig.toml` has the details.
