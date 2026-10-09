### fix(revision.city): render a diff when the diffs highlight workers fail to start

When the `@pierre/diffs` highlight worker pool failed to initialize, for example when the worker
script at `/assets/worker-<hash>.js` returned 404 or hit a network error, the diff viewer never
rendered and the page stayed on its loading status. The review UI showed the viewer only after the
pool reported `managerState: 'initialized'`. A failed pool goes back to `'waiting'` and sets
`workersFailed`, so it never got there, and the gate stopped the library's fallback to highlighting
on the main thread.

The gate now also opens when the pool reports `workersFailed`, and the viewer then renders without
the pool (`disableWorkerPool`). Opening the gate alone was not enough: a viewer that still used the
failed pool called `setRenderOptions` to set its theme, and in 1.5.1 and 1.5.2 that call starts a
new initialization even after a failure. Each attempt requested the worker script again and hid the
viewer until it failed, so the diff flickered and the requests did not stop. Without the pool, the
viewer highlights on the main thread with the theme the reader picked.

A Playwright test, `worker-fallback.e2e.test.ts`, answers the worker script with 404 and the diff
request with a fixture patch. It pins the core count so the pool always starts three workers, then
checks that the file renders with highlighted tokens and that the page requests the script exactly
once for each pool worker.
