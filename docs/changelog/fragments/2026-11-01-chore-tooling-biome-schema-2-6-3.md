### chore(tooling): move the Biome config schemas to 2.6.3 and let Renovate keep them in step

The repo pins `@biomejs/biome` 2.6.3, but every Biome config still named the 2.5.14 schema in its
`$schema` URL. Each `biome check` and `biome format` run printed a "configuration schema version
does not match" notice for each app. `biome migrate --write`, run from `workspaces/web-apps` with
the pinned CLI, changed the URLs and no other setting: version 2.6 needs no other config migration.
The migrate also removed the trailing commas from the two `.jsonc` files, so oxfmt put them back.
The two joy-of-react configs got the same URL change by hand, because `biome migrate` cannot load
them. They extend the repo-root `biome.jsonc`, which no longer exists.

The URLs fell behind the CLI before: a change in 2026-09 moved them from 2.5.10 to 2.5.14. A new
regex custom manager in `.github/renovate.json` now reads each Biome config's schema URL as an
`@biomejs/biome` dependency. So the "biome packages" group moves the URLs in the same PR as the CLI
pins. The manager runs no commands, so `RENOVATE_ALLOWED_COMMANDS` does not change.
