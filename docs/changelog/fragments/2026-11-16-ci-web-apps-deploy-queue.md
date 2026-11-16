### ci(web-apps): run one production deploy per worker at a time

The production deploy job now has a job-level concurrency group keyed on the worker name, with
`cancel-in-progress: false`. When several merges land close together, a second deploy of one worker
waits for the first to finish instead of running beside it, so the D1 migrations step never runs
twice at once. Deploys of other workers still run side by side.
