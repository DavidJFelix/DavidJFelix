### chore(warden): gate the CI review behind the Warden label

Warden reviewed every non-draft PR on every push, and the per-push model spend added up fast. The
review is now on demand: `ci-warden.yml` triggers only on `labeled` events with a job-level guard on
the `Warden` label, so other labels never allocate a runner and nothing runs (or bills) unless
asked. Adding the `Warden` label to a PR -- drafts included -- reviews its current head; remove and
re-add the label to re-run. The `getsentry/warden` action cannot review a PR from
`workflow_dispatch` (it routes dispatch events to schedule-type sweep triggers, and its
analyze/report modes require a pull_request event), so the label is the dispatch button for PR
reviews; a second job in the same workflow covers true `workflow_dispatch` by running the
mise-pinned warden CLI against whatever branch the dispatch selects (diffed from its merge-base with
a `base` input, default `main`), with findings in the job log rather than posted to a PR.
`warden.toml`'s triggers now mirror the label filter (`actions = ["labeled"]`,
`labels = ["Warden"]`), and CONTRIBUTING plus the review-consolidation plan record the always-on to
label-gated decision.
