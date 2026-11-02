### fix(joy-of-react): point the Biome configs at the web-apps workspace config

The Biome configs of the two Joy of React projects extended `../../../biome.jsonc`, the repo-root
config that the Turborepo consolidation moved to `workspaces/web-apps/biome.jsonc`. Biome could not
load either config, so the `lint` and `format` scripts of the projects failed. Each project now has
a `biome.jsonc` root config that extends `../../web-apps/biome.jsonc`. The old root config had the
same Biome rules, so the projects get the rules they had before the move. That rule set is not the
full Biome set: it keeps only the rules that oxlint does not have, and the `lint` script of each
project also runs oxlint. The configs now use JSONC, as the configuration style guide requires.

The web-apps config lets Biome format only `.astro` and `.svelte` files, because oxfmt formats the
other files there. These projects do not use oxfmt, so each config sets the Biome formatter to its
JS, JSX, CSS, and JSON files. Now `format` and `lint` check the project sources. The sources already
had the correct format, so no file changed.
