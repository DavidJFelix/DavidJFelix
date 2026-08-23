### test(revision.city): run the hook tests on testing-library and msw

The `usePullRequestGroups` and `useEntityDiffs` tests mounted each hook through a hand-rolled probe
component that wrote the hook's return value into a closure variable on every render, and stubbed
`globalThis.fetch` with hand-built response objects. oxlint's `react(globals)` rule flagged the
render-time reassignment, and the stubs were the kind of scaffolding testing-library already
provides. The tests now render through `renderHook` and settle on `waitFor`, and the requests are
served by an msw `setupServer` with `http` handlers per test, so the hooks go through the real
`fetch` and `Response` path their callers use. msw joins the app's devDependencies. Per-test handler
scoping and testing-library cleanup hang off vitest's `onTestFinished`, keeping the suite free of
lifecycle hooks.
