### fix(revision.city): report why a diffs worker fails instead of logging `[object Event]`

A failed diffs highlight worker reached Sentry as `Worker error: [object Event] [object Object]` and
`Error: [object Event]`. Both came from `@pierre/diffs` 1.5.1: its pool logged the raw `error` event
and the pool's internal worker record, then turned the event into an `Error` with `String(event)`.
In Chromium, the `Worker` gets an event with no message when the browser cannot fetch the worker
script (an error status or a network error). A script that throws, or that is not JavaScript, gives
an `ErrorEvent` with a message.

`@pierre/diffs` moves to 1.5.2, which adds an `onWorkerError` pool option. When the option is set,
the pool gives the event to the option instead of logging the raw objects. The release also catches
its own failed initialization, which was the unhandled `Error: [object Event]`. revision.city's
handler writes one report for each distinct failure on a page and raises it with `reportError`, so
Sentry's `onerror` handler records a real message. For a load failure, the handler fetches the
worker script again and reports the status and content type the server returns, or the network
error. It also reports how long the page was open and `navigator.onLine`. An uncaught error reports
its message and its script location.

`workerFactory` now constructs the worker from its `?worker&url` import, so the handler knows which
URL to fetch. Vite's own rule for the worker type stays the same: a module worker in dev and a
classic worker in builds.

The PR workflow in `CONTRIBUTING.md` and the comments rule in `AGENTS.md` now ask authors to run the
`comment-review` skill over the diff before each push that changes prose. `comment-style.md` names
the two findings that the first review of this change raised: a claim that the code does not
support, and old wording in a touched comment.
