### fix(web-apps): stop tanstack releases from invalidating the lockfile

`@tanstack/react-start` shipped 1.168.38 and moved the `latest` dist-tag, so
`bun install --frozen-lockfile` rejected the lockfile's 1.168.34 constellation -- the second
tanstack-release CI outage in a week, because frozen installs re-resolve dist-tags and five apps
declared the tanstack packages as `latest`.

The structural fix: a bun workspace catalog now declares the aligned exact set once at the root
(react-start 1.168.38, react-router 1.170.21, router-plugin 1.168.26, plus react-devtools,
react-router-devtools, and devtools-vite at their locked versions), and the apps reference them as
`catalog:`. With no dist-tag left to re-resolve, an upstream release cannot invalidate the lockfile.
The four `@tanstack` overrides from 2026-08-06 are gone: they existed to stop a floated top-level
router from splitting the tree against react-start's exact internal pin, and exact aligned catalog
versions leave no float to split. The alignment rule -- react-router and router-plugin must match
what react-start pins internally, bumped as one set -- is documented beside the override rationale
in bunfig.toml.

One migration gotcha for existing checkouts: bun does not rewrite an existing store directory's
internal symlinks when an override change alters its dependencies' resolutions, so after this change
a stale store left react-start linked to the old router and the `server` route option's module
augmentation landed on the wrong router-core, failing typecheck. Delete `node_modules` and reinstall
once; fresh installs (CI, new containers) link correctly. Verified with a frozen install and
typecheck across all five react-start apps from a clean tree.

Renovate's bun-catalog support is unproven, so catalog bumps may be manual for now -- no automation
is lost, since renovate never managed the `latest` declarations either.
