### chore(repo): dual-license code MIT OR Apache-2.0, CC0 docs, CC-BY blog content

The repo-root `LICENSE` (formerly a lone CC0 dedication) is replaced by a `LICENSE.md` map of what
is licensed how, with full texts beside it in `LICENSE-MIT` and `LICENSE-APACHE`. Every project
carrying a `package.json` or `Cargo.toml` -- the twelve apps, the advent-of-code trees, and the
Exercism exercises -- now declares `(MIT OR Apache-2.0)` (`MIT OR Apache-2.0` in Cargo terms) in its
manifest, and the stray Apache-only `LICENSE` files in `apps/djf.io` and `workspaces/advent-of-code`
are removed in favor of the root pair. The CC0 dedication moved to `docs/LICENSE`, so the
documentation tree is explicitly public domain, and blog writing in `apps/djf.io/src/content/` and
`src/drafts/` is now CC-BY-4.0 via a copy of the legal code at `src/content/LICENSE`.

Two carve-outs are recorded rather than relicensed. `apps/revision.city` gained a `NOTICE.md`
attributing its `/diffs` viewer to the diffshub application from Pierre Computer Company's PierreJS
monorepo: those portions, and the published `@pierre/*` packages the app consumes, remain Apache-2.0
only, so the MIT option does not extend to them. The Joy of React course projects under
`workspaces/joy-of-react/` keep Josh's Course Materials License, with
`"license": "SEE LICENSE IN license.md"` making the retention explicit in each manifest.
CONTRIBUTING.md documents the scheme and the inbound-contribution rule, and the file-naming
exceptions now cover the `LICENSE-MIT`/`LICENSE-APACHE`/`NOTICE.md` names.
