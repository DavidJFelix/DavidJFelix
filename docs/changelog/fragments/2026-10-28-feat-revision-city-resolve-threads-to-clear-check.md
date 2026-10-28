### feat(revision.city): resolve the review threads to clear a failed check

Before this change, a Revision City check that failed on findings stayed red until a new review ran,
also when every finding was false. Now a check run that failed only on findings passes when every
Revision City thread on lines that the head still has is resolved. Its title then starts with
`Resolved:`. When one of the threads opens again, the check fails again.

The webhook gets the `pull_request_review_thread` event. For a thread that the app started, it
counts the open threads of the app with the GraphQL API and updates the latest check run on the
head. A check run that can change this way has the external id `resolvable-findings`. A check run
from before this change does not have it, so it stays red. A failed chunk review has no thread, so
it also keeps the check red.

A new review also uses this rule. When the findings that fail it are all on lines where an earlier
run posted them, in threads that are resolved, the review passes and posts nothing.

The app's webhook must subscribe to the "Pull request review thread" event.
