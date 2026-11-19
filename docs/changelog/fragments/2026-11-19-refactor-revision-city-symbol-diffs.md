### refactor(revision.city): read the symbol diffs of the Symbols tab through an XState store

`useSymbolDiffs` is now a thin wrapper over a store in `src/symbols/state/symbol-diffs-store.ts`,
and its callers do not change. The store is `stopped`, `idle`, or `reading`, and at most one batch
of files is in flight. Each batch has an id, so a result, a stream end, or a failure for a batch
that is no longer in flight changes nothing. The rules that the hook spread over refs and effect
order are now in the transition table, with tests. A file that the stream does not answer fails, an
abort keeps the results that arrived, and a retry asks again only for the files that failed. A retry
during a batch no longer cancels that batch; the files that failed go out in the next batch. When
the viewer opens another diff, the tab no longer shows the symbol changes of the previous diff while
the new one loads.
