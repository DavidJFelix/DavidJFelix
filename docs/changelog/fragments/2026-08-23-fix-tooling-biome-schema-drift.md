### fix(tooling): realign biome config schemas and let renovate keep them aligned

Every biome config pinned a `$schema` URL from an older release (mostly 2.5.0) than the biome that
actually runs, so each invocation printed the "configuration schema version does not match the CLI
version" diagnostic. The web-apps configs (the workspace root plus every app and package) now point
at 2.5.8, matching the mise-locked binary, and the joy-of-react exercise projects point at 2.5.9,
matching their `@biomejs/biome` pin.

To stop the drift from coming back, a renovate custom manager now versions the URL segment of every
`biome.json`/`biome.jsonc` `$schema` as an `@biomejs/biome` dependency, and the existing biome
packages group carries those updates in the same PR as the binaries. That only works if the mise
side actually receives bumps, so `biome` in mise.toml moves from the loose `"2"` to an exact
`"2.5.8"` -- with a range, renovate had nothing to update and the binary only moved through lockfile
maintenance, leaving the schema URLs to race ahead.
