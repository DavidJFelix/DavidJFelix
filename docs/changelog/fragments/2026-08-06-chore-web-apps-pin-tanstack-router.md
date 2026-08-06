### chore(web-apps): pin the @tanstack router packages via overrides

`@tanstack/react-router` 1.170.19 landed on npm and turned every CI job that installs the workspace
red: the apps declare these packages as `latest`, and `bun install --frozen-lockfile` must resolve
the `latest` dist-tag to validate the lockfile, so an upstream release alone invalidates it.
Accepting the float is not an option yet -- `@tanstack/react-start` pins react-router 1.170.18
exactly, so a floated top-level copy splits the tree into two react-routers and the `server` route
option's module augmentation lands on the wrong one, failing typecheck.

Four `overrides` entries (react-router, react-router-devtools, router-core, router-devtools-core)
pin the versions the lockfile already held. No installed version changed. Lift the pins when
react-start ships a release aligned with the newer router.
