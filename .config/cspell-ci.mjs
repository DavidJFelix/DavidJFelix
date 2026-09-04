// CI config: the base config plus the JUnit reporter for Depot's test results
// view. JavaScript rather than JSONC because cspell resolves reporters by name
// from the working directory or its own install, neither of which can see the
// reporter's separate mise install, so the path has to come from the environment.
const reporter = process.env.CSPELL_JUNIT_REPORTER
if (!reporter) {
  throw new Error('CSPELL_JUNIT_REPORTER is unset; run this config through `mise run spell:ci`')
}

export default {
  import: ['./cspell.jsonc'],
  reporters: ['default', [reporter, {outFile: 'test-results/cspell-junit.xml'}]],
}
