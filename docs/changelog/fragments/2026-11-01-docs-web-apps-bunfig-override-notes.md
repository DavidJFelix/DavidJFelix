### docs(web-apps): correct the bunfig override notes

The comment in `workspaces/web-apps/bunfig.toml` that explains the root `overrides` had two bullets
that no longer matched `workspaces/web-apps/package.json`. This change deletes the
`@distilled.cloud` bullet, because the root `package.json` has no `@distilled.cloud/*` overrides.
Without them, `bun.lock` holds one copy of each `@distilled.cloud/*` package. The rolldown bullet
gave the version as 1.2.1, but the override is 1.2.15. The bullet now has no version numbers. It
says that the override makes every consumer use one rolldown version, and that a change needs the
djf.io e2e tests with `CI=1`.
