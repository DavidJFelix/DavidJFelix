### chore(warden): gate the CI review behind the Warden label

Warden reviewed every non-draft PR on every push, and the per-push model spend added up fast. The
review is now on demand: `ci-warden.yml` triggers only on `labeled` events with a job-level guard on
the `Warden` label, so other labels never allocate a runner and nothing runs (or bills) unless
asked. Adding the `Warden` label to a PR -- drafts included -- reviews its current head; remove and
re-add the label to re-run. A `workflow_dispatch` trigger was considered and rejected: the
`getsentry/warden` action routes dispatch events to schedule-type sweep triggers (issue reports) and
its analyze/report modes require a pull_request event, so the label is the manual dispatch button.
`warden.toml`'s triggers now mirror the same filter (`actions = ["labeled"]`,
`labels = ["Warden"]`), and CONTRIBUTING plus the review-consolidation plan record the always-on to
label-gated decision.
