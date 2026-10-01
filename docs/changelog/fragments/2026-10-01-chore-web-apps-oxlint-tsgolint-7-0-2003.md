### chore(web-apps): move oxlint-tsgolint to 7.0.2003 with oxlint 1.86.0

oxlint 1.86.0 sends the new type-aware rule `no-generated-empty-object-type` to tsgolint and
declares a peer dependency on `oxlint-tsgolint >=7.0.2003`. The Renovate oxc group moved oxlint at
the repo root but left the web-apps catalog on 7.0.2001, which does not know the rule and panicked,
so every web-apps lint task failed. The catalog now pins 7.0.2003.
