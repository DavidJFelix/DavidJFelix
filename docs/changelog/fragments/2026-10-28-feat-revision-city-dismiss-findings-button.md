### feat(revision.city): add a Dismiss findings button to a failed check

A failed Revision City check run now shows a `Dismiss findings` button. When a user who can push to
the repository clicks it, the check run passes without a new review. Its title then starts with
`Dismissed:`, and its summary names the user. Resolving threads cannot clear a check that failed on
a failed chunk review, because that check has no threads. The button covers that case.

GitHub sends a `check_run` event with the `requested_action` action. The webhook checks the user's
permission on the repository and refuses a user who cannot push. A dismissed check run has the
external id `dismissed`, so resolved or reopened threads no longer change it. When a check run
passes, the app removes the button.

The app's webhook must subscribe to the "Check run" event.
