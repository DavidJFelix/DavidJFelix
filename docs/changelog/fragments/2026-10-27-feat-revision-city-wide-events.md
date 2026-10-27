### feat(revision.city): log one wide event for each review run and each model call

A review now logs one structured `review run` event when it ends, also when GitHub is down. The
event has the repository, the pull request, the head, the model, the outcome (`success`, `failure`,
`superseded`, `skipped`, or `error`), the chunk review counts, and the finding counts. A `skipped`
event, and an `error` event from a failed start, have no head and no counts. Each OpenRouter call
also logs one `model call` event with its duration, tool call count, tokens, and cost, or with its
error. The cost of a run is the sum of its `model call` events. A step that runs again reads the
reviews of its failed attempt from the store at no cost. The events go through `console.log` as
objects, so Workers Logs and the OpenTelemetry export keep each field separate. This is the first
step of the observability plan: the next change sends these logs to Honeycomb.
