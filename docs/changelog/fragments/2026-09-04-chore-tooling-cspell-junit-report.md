### chore(tooling): report cspell findings to Depot's test results view

The `ci-spell` workflow now runs `mise run spell:ci`, which spell-checks through a new
`.config/cspell-ci.mjs` config: the same base config plus `@cspell/cspell-junit-reporter`, writing
`test-results/cspell-junit.xml`. A `depot/test-report-action` step uploads that report (guarded with
`!cancelled()` so a failing spell run still reports) and Depot's dashboard lists each misspelling as
a failed test case. The default reporter stays on, so the CI log reads exactly as `mise run spell`
does locally, and local runs are untouched: the JUnit reporter is only wired into the CI task. The
reporter is a mise-managed npm tool like cspell itself; because its install is off cspell's module
path, the task resolves its location with `mise where` and passes it to the config through the
environment. cspell itself stays at 10.1.1 for now; renovate's cspell group will bring the two
packages into step on the next bump.
