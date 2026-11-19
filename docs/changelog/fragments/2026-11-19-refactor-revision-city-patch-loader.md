### refactor(revision.city): model the diff load with XState Store

`usePatchLoader` keeps the load lifecycle of a diff in a new XState Store,
`src/diffs/state/patch-load-store.ts`. The store holds the status, the request id, the retry count,
the error with its remedy, and the publish phase of a streamed diff. Each result of a load names its
request id, and the store refuses a result for an old request. Before, an old stream that ended
after a new load started could mark the new load ready with the old file diffs and stats. A late
response could also show `streaming` for the new load. A retry is now possible only from `error`.
The streamed file diffs still go to the viewer from the hook and do not pass through the store.
