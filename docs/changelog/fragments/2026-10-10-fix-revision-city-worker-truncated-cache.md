### fix(revision.city): recover the diffs worker from a truncated cached script and from a deploy

In Firefox 155, the diffs highlight worker failed on each page load, and the refetch in the failure
report returned 200. A HAR of the failure shows the cause. The browser asked for
`/assets/worker-<hash>.js` with `If-None-Match`, the server answered 304, and Firefox used its
cached copy. That copy had only 256 KiB of the compressed response, which is 733,088 of the 836,769
characters in the script. The truncated script does not parse, so the worker failed. Because asset
responses have `max-age=0, must-revalidate`, each page load revalidated the same copy, got 304
again, and failed again. The report did not show this because the refetch used `cache: 'no-store'`
and cancelled the body. The Firefox behavior comes from the HAR only; a search found no Mozilla bug
that describes it.

The refetch now uses `cache: 'reload'` and reads the full body. A `reload` request ignores the
cached copy and puts the full response in the cache. The report also gives the size of the body that
the refetch read. The result of the refetch then decides what the page does:

- **200**: the cache now holds a complete script, so the page starts the worker pool again. The
  review UI holds the viewer until the second start ends, because a viewer that mounts without the
  pool does not use it later.
- **404**: a deploy removed the script that this page asks for. The page reloads once to get the
  names of the current scripts. A mark in session storage for that script URL stops a second reload.
- **Any other result**: the diff renders on the main thread, as before.

A lazy chunk from an old deploy has the same problem. On `vite:preloadError`, the page reads the
chunk URL from the error message and asks the server for it. If the server answers 404, the page
reloads once, with the same session storage mark. Safari puts no URL in the message, so Safari does
not reload.
