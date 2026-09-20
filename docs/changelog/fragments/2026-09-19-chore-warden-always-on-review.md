### chore(warden): review every non-draft PR again, at high effort

The July label gate existed because per-push reviews on the model of the day added up fast. With
`WARDEN_MODEL` now pointed at a model cheap enough that a review is a rounding error, the gate goes
back to always-on: `ci-warden.yml` triggers on `opened`, `synchronize`, `reopened`,
`ready_for_review`, and `labeled`, and a job-level guard mirrors `warden.toml`'s trigger filter so
skipped events never allocate a runner -- non-draft PRs review on every non-label event, and on a
`labeled` event only the `Warden` label runs (drafts included, which is how a draft opts in). PRs
opened by the repo's GitHub App -- Renovate's dependency bumps and the weekly changelog roll-up,
both `djf-renovate[bot]` -- are excluded from the automatic path, since reviewing a lockfile bump is
spend without signal; `warden.toml` cannot filter on author, so that rule lives only in the job
guard, and the label opts a bot PR in when one deserves a look. The label is now the re-run lever
rather than the only way to get a review. `warden.toml` restores the pre-gate triggers
(`draft = false` plus `labels = ["Warden"]`) and adds `[defaults.agent] effort = "high"`, the first
dial to turn back down if the model ever changes to a pricier one. A clean run used to be visible
only as check runs on the commit -- Warden posts inline comments only for findings on a diff line,
and its `reportOnSuccess` option turns out to be inert in 0.48.0 (a body-only COMMENT review is
dropped before posting) -- so the workflow gains a last step, `bin/comment-warden-summary.ts`, that
keeps one sticky PR comment current with the latest run: the head it reviewed, per skill the
findings count, duration, and cost, and every finding in full with a link to its lines at that head
-- including the low-severity ones Warden itself keeps in Checks. CONTRIBUTING and the
review-consolidation plan record the reversal.
