### test(revision.city): run unit tests in the node environment by default

The revision.city unit tests now run in node by default. Before, every test file started a jsdom
browser, and most files did not use it. The file name now picks the environment, through two Vitest
projects: `*.test.tsx` and `*.dom.test.ts` run in jsdom, and the other `*.test.ts` files run in
node. Four `.ts` tests that read browser globals are renamed to `.dom.test.ts`, and the six
`// @vitest-environment node` lines are gone. A new test that reads `window`, `document` or
`navigator` with a plain `.test.ts` name fails at once. A full `bun run test` took about 32 s before
and 16 s after on a 4-core container.
