### chore(warden): run the CI review only when a PR gets the Warden label

Warden no longer reviews each PR on open and on each push. `ci-warden.yml` now triggers only on
`labeled` events, and its job runs only for the `Warden` label. Add the label to a PR, draft or bot
PR included, to review its current head. Remove and add it again to run again. `warden.toml`'s
triggers use the same filter (`actions = ["labeled"]`, `labels = ["Warden"]`). The dispatch path for
branches does not change.

revision.city reviews each push from its GitHub App, so Warden is now only for a second opinion.
CONTRIBUTING's code review section now says the same.
