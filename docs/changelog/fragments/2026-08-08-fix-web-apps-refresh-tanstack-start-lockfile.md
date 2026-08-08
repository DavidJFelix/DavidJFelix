### fix(web-apps): refresh the lockfile for the tanstack react-start release

`@tanstack/react-start` shipped 1.168.38 and moved the `latest` dist-tag, so
`bun install --frozen-lockfile` no longer accepted the lockfile's 1.168.34 constellation. A plain
install re-resolved react-start and its internal packages (start-client-core, start-plugin-core,
start-server-core, start-storage-context, router-generator, router-plugin, and a nested
`@tanstack/history` copy) to the aligned patch versions and dropped the nested overrides the old
resolution needed.

The four `overrides` pins from the 2026-08-06 entry stay as they are: react-router `latest` is now
1.170.23 while react-start 1.168.38 pins 1.170.21 exactly, so lifting them would still split the
tree into two react-routers. Typecheck passes across all five react-start apps with the pinned
router under the new react-start.
