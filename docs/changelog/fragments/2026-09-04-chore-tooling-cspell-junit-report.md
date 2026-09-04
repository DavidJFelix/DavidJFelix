### chore(tooling): report cspell findings to Depot's test results view

The `ci-spell` workflow now runs `mise run spell:ci`: the same cspell command as `spell`, with
`@cspell/cspell-junit-reporter` passed on the command line and its output redirected to
`test-results/cspell-junit.xml`. A `depot/test-report-action` step uploads that report (guarded with
`!cancelled()` so a failing spell run still reports) and Depot's dashboard lists each misspelling as
a failed test case. Local `mise run spell` is untouched and keeps the human-readable output; the
JUnit reporter is only wired into the CI task. The reporter is a mise-managed npm tool like cspell
itself.
