### feat(og): render a share card at request time on every public app

Outside djf.io, no app emitted an `og:image`, an `og:url`, or a twitter card, so a pasted link
unfurled as bare text or not at all. Every public app now serves a 1200x630 card at
`/og/default.png`, rendered on its Worker at request time, and its head carries the absolute
`og:url`, a canonical link, `og:locale`, the card with its size and alt text, and the large-image
twitter card -- with a real description where the domain name used to stand in (startchi.com,
revision.city, f311x).

`@davidjfelix/og` grew the pieces. `ogSite` builds the site-level tag bundle from an origin, a name,
a title, and a description, and each app keeps those in a `site.ts` beside the card colors it takes
from its own design tokens. The renderer moved from native `sharp` to `@resvg/resvg-wasm`, with
satori's standalone build taking Yoga as a module, so one code path draws the card in Node at build
(djf.io's prerendered per-post cards, unchanged) and on Workers at request time. `OgTheme` colors
the shared template per app. `ogCard` is the request handler, keeping the rendered PNG in the
Workers Cache API so a burst of scrapers rasterizes once per edge location. Three runtime modules
load the two wasm binaries and the Inter files the way each bundler allows -- `.wasm` imports and
`?inline` fonts for Vite-bundled Workers, unwasm's `?module` and Nitro's `raw:` for Nuxt, disk reads
for Node -- resolving from the package's own tree so no app declares the binaries. A Vitest plugin
stands in for the bundlers so those modules are tested as written, at 100% coverage.

Per framework: TanStack Start apps mount the card as a server route and their root routes read the
requested path off the leaf match for `og:url` (startchi.com, revision.city, ravrun,
forzamonica.com, whose product pages also offer the product photo as the card); Astro serves it from
an on-demand endpoint (davidjfelix.com); SvelteKit loads the runtime on the first request, since its
build imports every route module in Node, behind a small Vite plugin that leaves `.wasm` imports for
wrangler's bundler (monicandavid.com); Nuxt serves it from a Nitro route behind
`nitro.experimental.wasm` (pkg.dog). ravrun emits no `og:url` because its prerendered SPA shell
serves every path. f311x deploys through alchemy without a wasm module rule and calendar-visualizer
has no canonical domain yet, so both get the tags and a `summary` card without an image; onvibes.org
and alchemy-state-viewer sit behind Cloudflare Access and stay as they were. Every app's e2e suite
asserts the tags and fetches the card from the local workerd boot, checking the PNG header for
1200x630 through the package's `pngSize`.

Preview deploys bake their own `pr-<N>` URL into those tags: the preview action resolves the alias
URL ahead of the build (`bin/preview-url.ts`, from the account's workers.dev subdomain) and hands it
to the build under each framework's public env prefix, and each app's e2e expects that origin when
it runs against a preview. Production builds keep the canonical origin.

satori is held at 0.32 by a Renovate rule: 0.33 added HarfBuzz text shaping whose Emscripten loader
reads `self.location` and compiles wasm from bytes, neither of which Workers allow. The Workers plan
tier is not knowable from the repo, and a cold render took about a second under miniflare, far past
the free plan's 10 ms CPU cap, so the first production deploy should fetch one card cold; the
project plan records the fallback (prerender at build, as djf.io does).
