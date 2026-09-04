// CI-only cspell config: the base config plus the JUnit reporter, so Depot CI
// lists every misspelling as a test case
// (https://depot.dev/docs/ci/observability/depot-ci-test-results). Local runs
// (`mise run spell`) use .config/cspell.jsonc directly and keep the
// human-readable default output; this config keeps that output too, so the CI
// log still reads the same way. The reporter package sits in its own mise
// install, off cspell's module path, so the spell:ci task hands its location in.
const reporter = process.env.CSPELL_JUNIT_REPORTER
if (!reporter) {
  throw new Error('CSPELL_JUNIT_REPORTER is unset; run this config through `mise run spell:ci`')
}

export default {
  import: ['./cspell.jsonc'],
  reporters: ['default', [reporter, {outFile: 'test-results/cspell-junit.xml'}]],
}
