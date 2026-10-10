### fix(revision.city): replace a truncated diffs worker script in the browser cache

In Firefox 155, the diffs highlight worker failed on each page load, and the refetch in the failure
report returned 200. A HAR of the failure shows the cause. The browser asked for
`/assets/worker-<hash>.js` with `If-None-Match`, the server answered 304, and Firefox used its
cached copy. That copy had only 256 KiB of the compressed response, which is 733,088 of the 836,769
characters in the script. The truncated script does not parse, so the worker failed. Because asset
responses have `max-age=0, must-revalidate`, each page load revalidated the same copy, got 304
again, and failed again. The report did not show this because the refetch used `cache: 'no-store'`
and cancelled the body.

The refetch now uses `cache: 'reload'` and reads the full body. A `reload` request ignores the
cached copy and puts the full response in the cache, so the next page load gets a complete script.
The report now also gives the size of the body that the refetch read, which shows a truncated
response from the server too. On the page that fails, the diff still renders on the main thread, as
it did before.
