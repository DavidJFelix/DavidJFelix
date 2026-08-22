### docs(tooling): document Depot CI failure triage for agents

Depot CI posts bare check runs to GitHub -- a name, a conclusion, and a dashboard link, with empty
output even on failure -- so agent sessions had no way to read failing CI output and were reduced to
guessing from job names. A new docs/agents/depot-ci.md documents the depot CLI path instead: finding
run and job IDs from a check run's details_url or `depot ci run list`, then `diagnose`, `logs`,
`summary`, and `artifacts` in order of signal, plus retries and patch-based local runs. It also
records the auth requirement the commands share -- a `DEPOT_TOKEN` holding a user or org token --
and what to do when the session has none.
