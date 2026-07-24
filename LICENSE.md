# License

This repository holds code, documentation, and writing, and they carry different licenses. The rules
below say which license applies where; each rule links the full license text it relies on, named
`LICENSE.<SPDX-identifier>.md`.

## Code: MIT OR Apache-2.0

Unless a rule below says otherwise, everything in this repository -- the top-level files and every
project that carries a `package.json` or `Cargo.toml` (`apps/`, `crates/`, `Exercism/`,
`workspaces/advent-of-code/`, `bin/`) -- is dual-licensed under either of:

- Apache License, Version 2.0 ([LICENSE.Apache-2.0.md](LICENSE.Apache-2.0.md))
- MIT license ([LICENSE.MIT.md](LICENSE.MIT.md))

at your option. Both texts are also colocated in every package directory, so each package stands
alone when taken out of the repo.

## Documentation: CC0-1.0

The documentation under [docs/](docs/) is dedicated to the public domain under CC0 1.0 Universal
([docs/LICENSE.CC0-1.0.md](docs/LICENSE.CC0-1.0.md)). The same dedication already applies to
[dotfiles/](dotfiles/) ([dotfiles/LICENSE.CC0-1.0.md](dotfiles/LICENSE.CC0-1.0.md)).

## Blog content: CC-BY-4.0

Blog posts and drafts -- the writing in `apps/djf.io/src/content/` and `apps/djf.io/src/drafts/` --
are licensed under the Creative Commons Attribution 4.0 International license
([apps/djf.io/src/content/LICENSE.CC-BY-4.0.md](apps/djf.io/src/content/LICENSE.CC-BY-4.0.md)). The
djf.io application code around that writing stays MIT OR Apache-2.0.

## Third-party origins

- `apps/revision.city` includes a diff viewer that began as a port of the diffshub application from
  Pierre Computer Company's PierreJS monorepo, received under Apache-2.0. The application as a whole
  is offered under MIT OR Apache-2.0, as Apache-2.0 permits for derivative works; the origin notice,
  retained copyright, and colocated license copy that its terms require live in
  [apps/revision.city/NOTICE.md](apps/revision.city/NOTICE.md).
- `workspaces/joy-of-react/` contains material from Josh W. Comeau's Joy of React course and retains
  Josh's Course Materials License (each project's `LICENSE.md`). It is not covered by the licenses
  above.
- Vendored or course-derived code keeps its original license; when adding any, record the
  attribution in a `NOTICE.md` beside it rather than changing these files.

## Contributions

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in
this repository by you, as defined in the Apache-2.0 license, shall be dual-licensed as above,
without any additional terms or conditions.
