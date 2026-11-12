### test(revision.city): run unit tests in the node environment by default

The revision.city unit tests now run in node by default. Before, every test file started a jsdom
browser, and most files did not use it. The 19 files that need the DOM start with
`// @vitest-environment jsdom`. The six engine and proxy tests that asked for node no longer need
their line. A new test file that reads `window`, `document` or `navigator` fails at once until it
gets the jsdom line. A full `bun run test` took about 32 s before and 18 s after on a 4-core
container.
