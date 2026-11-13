### feat(revision.city): review again when a user reruns the check

A click on Re-run on the Revision City check run now starts a review. So does a click on Re-run all
checks. The review is the same one that the `Revision City` label starts, at the current head of the
pull request. Each click gets its own Workflow instance from the delivery id, and saved chunk
reviews cover every unchanged chunk. Re-run all checks needs the GitHub App to subscribe to "Check
suite" events.
