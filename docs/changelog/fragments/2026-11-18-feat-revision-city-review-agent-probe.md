### feat(revision.city): send one probe prompt to the harness in each review run

The `revision-city` Worker now has a binding, `REVIEW_AGENT`, to the `ReviewAgent` Durable Object of
the harness Worker `revision-city-harness-opencode`. Each review run sends one short prompt to that
object in a Workflow step, `probe review agent`, and logs the result as one `review agent probe`
event. The event has the fields of the run, the outcome (`success`, `unanswered`, or `error`), the
duration, the model of the harness, the start of the answer, and the tokens and the cost.

This is the live proof of the path from a review run to the harness. The review does not use the
answer: the findings, the check run, and the summary comment do not change. The probe runs at the
same time as the review. It stops after 2 minutes, and a probe that fails only logs an `error`
event. All probes use one Durable Object, so the sessions of the probes are in one database.

Each review run now costs one more model call, on DeepSeek V4.1 Flash through the harness. The
harness Worker needs the `OPENROUTER_API_KEY` secret. Until it has the secret, the event shows the
`unanswered` outcome. The dev Worker and the previews have no binding, as they have no reviews.

The comment in `.config/cspell.jsonc` and the spelling guide now name `companies` among the bundled
dictionaries that have an `-extra` dictionary.
