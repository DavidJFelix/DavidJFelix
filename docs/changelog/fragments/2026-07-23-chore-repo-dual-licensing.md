### chore(repo): dual-license code MIT OR Apache-2.0, CC0 docs, CC-BY blog content

The repo-root `LICENSE` (formerly a lone CC0 dedication) is replaced by a `LICENSE.md` map of what
is licensed how. Full license texts are named `LICENSE.<SPDX-identifier>.md`: `LICENSE.MIT.md` and
`LICENSE.Apache-2.0.md` live at the root and are colocated into every package directory so each
package stands alone. Every project carrying a `package.json` or `Cargo.toml` -- the twelve apps,
the advent-of-code trees, and the Exercism exercises -- declares `(MIT OR Apache-2.0)`
(`MIT OR Apache-2.0` in Cargo terms) in its manifest, and the stray Apache-only `LICENSE` files in
`apps/djf.io` and `workspaces/advent-of-code` are removed in favor of the named texts. The CC0
dedication moved to `docs/LICENSE.CC0-1.0.md` (with `dotfiles/` renamed to match), so the
documentation tree is explicitly public domain, and blog writing in `apps/djf.io/src/content/` and
`src/drafts/` is now CC-BY-4.0 via the legal code at `src/content/LICENSE.CC-BY-4.0.md`.

`apps/revision.city` gained a `NOTICE.md` recording that its `/diffs` viewer began as a port of the
diffshub application from Pierre Computer Company's PierreJS monorepo
(github.com/pierrecomputer/pierre), received under Apache-2.0. The app as a whole is offered under
MIT OR Apache-2.0, as Apache-2.0 permits for derivative works; the notice retains Pierre's
copyright, states the modifications, and sits beside a colocated copy of the license, which is what
its terms require. The Joy of React course projects under `workspaces/joy-of-react/` keep Josh's
Course Materials License, renamed to `LICENSE.md` and marked with
`"license": "SEE LICENSE IN LICENSE.md"` -- npm's sanctioned form for custom terms -- in each
manifest. CONTRIBUTING.md documents the scheme and the inbound-contribution rule, and the
file-naming exceptions now cover the `LICENSE.<SPDX>.md` and `NOTICE.md` names.
