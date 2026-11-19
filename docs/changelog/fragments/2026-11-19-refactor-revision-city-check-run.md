### refactor(revision.city): model the check run of a review as XState Store logic

A new `src/reviews/state/check-run-store.ts` holds the states of the check run of a review (in
progress, superseded, passed, failed, failed-resolvable, resolved, dismissed) in one transition
table. `decodeCheckRun` reads the state from the status, conclusion, external id, and output that
GitHub keeps, and `encodeCheckRun` writes it back with its title prefix and dismiss button.
`dismissCheckRun` now asks the table if a dismissal is legal and writes the encoded state only when
it is. The fields that it writes do not change.
