### fix(revision.city): keep the check red when a thread opens during a thread sync

`syncCheckRunWithThreads` and `runReview` now write the check run through the transition table in
`src/reviews/state/check-run-store.ts`, and `completeCheckRun` is gone. Before, two thread events at
the same time could pass the check with an open thread. The sync for a resolve counted no open
thread. The sync for a thread that opened again then read a failed check and changed nothing. Now
the sync counts the threads one more time after each write and corrects the check run. GitHub has no
compare-and-set for a check run, so three windows stay open. The sync overwrites a dismissal that
comes between its second read and its update. It misses a second thread change during the recount. A
GitHub read that does not show a recent write can give an old state. A failed check run now has the
external id `failed`, so a failure report that follows a resolvable result no longer stays
resolvable.
