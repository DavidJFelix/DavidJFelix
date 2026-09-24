# @davidjfelix/og

The OpenGraph integration every app in the workspace shares: one tag builder whose output each
framework consumes directly, one site-level helper that fills in the fields a share card needs, and
the satori + resvg title-card renderer that draws the 1200x630 PNG behind every app's `og:image` --
at request time on Cloudflare Workers, or at build time in Node for djf.io's prerendered per-post
cards. Consumed as a workspace dependency; apps import raw TypeScript source (no build step -- every
consumer bundles with Vite or Nitro).

| Subpath           | Contents                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.`               | `ogTags` -- OpenGraph/Twitter meta tags as plain attribute objects; `ogSite`; `ogImageSize`                                           |
| `./image`         | `createOgRenderer` -- the title card as PNG bytes, given a runtime; `OgTheme`                                                         |
| `./card`          | `ogCard` -- the `/og/default.png` request handler with edge caching; `ogCards` -- the same for a family of cards resolved per request |
| `./runtime/vite`  | The runtime for Vite-bundled Workers (TanStack Start, Astro, SvelteKit)                                                               |
| `./runtime/nitro` | The runtime for Nitro-bundled Workers (Nuxt)                                                                                          |
| `./runtime/node`  | The runtime for Node: build-time prerendering and tests                                                                               |
| `./png`           | `pngSize` -- reads a PNG's dimensions from its header, for tests                                                                      |

## Tags

`ogTags` emits only the fields it is given, so a site-level call carries the defaults and a
page-level call overrides just its own fields wherever the framework merges heads. `ogSite` builds
the site-level bundle: `og:url` and `og:image` resolved on the site's origin (scrapers only follow
absolute URLs), the shared card size and alt text, `og:locale`, and the large-image twitter card.

```ts
const site = {origin: 'https://startchi.com', siteName: 'startchi.com', title, description}
ogTags(ogSite({...site, path: pathname}))
```

Every entry is `{property, content}` or `{name, content}`, which all four frameworks take as-is.

Astro -- spread onto `<meta>` in a layout's head:

```astro
{ogTags(ogSite({...site, path: Astro.url.pathname})).map((tag) => <meta {...tag} />)}
```

TanStack Start -- the shapes are members of `MetaDescriptor`, head merging dedupes by name/property
with the leaf-most route winning, and the root route reads the requested path off the leaf match:

```ts
head: ({matches}) => ({meta: ogTags(ogSite({...site, path: matches.at(-1)?.pathname ?? '/'}))})
```

SvelteKit -- render inside `svelte:head`:

```svelte
{#each ogTags(ogSite({...site, path: page.url.pathname})) as tag}
  <meta {...tag} />
{/each}
```

Nuxt -- pass to unhead:

```ts
useHead({title, meta: ogTags(ogSite({...site, path: useRoute().path}))})
```

A page spreads over the helper to override or drop fields: ravrun's prerendered SPA shell serves
every path, so it passes `url: undefined`; an app without a card passes `image: undefined` and
`twitter: {card: 'summary'}`.

The origin is a build-time value. A preview build receives its own `pr-<N>` URL from
`.depot/actions/preview-wrangler` under the framework's public env prefix (`PUBLIC_SITE_URL`,
`VITE_PUBLIC_SITE_URL`, `NUXT_PUBLIC_SITE_URL`) and each app's `site.origin` prefers it, so a
preview's tags name the preview; production builds carry the canonical origin.

## The card

`createOgRenderer(runtime)` returns
`render({title, description, siteName, author?, date?, theme?})`, which resolves to PNG bytes:
satori lays the card out (Inter, regular and bold), resvg rasterizes the SVG. `theme` is
`{background, foreground, muted, accent?}`; each app passes the values behind its own design tokens,
and the default is djf.io's dark zinc card. Both engines run on WebAssembly, so the same code
renders everywhere -- what differs is how the two wasm binaries and the font bytes reach it, which
is what a runtime is:

- `./runtime/vite`: `.wasm` imports become WebAssembly modules uploaded with the Worker (the only
  form Workers accept -- they refuse to compile wasm from bytes at runtime) through the Cloudflare
  Vite plugin's module rule, and `?inline` folds the font files into the bundle as data URLs.
  SvelteKit's adapter hands wrangler an unbundled worker, so monicandavid.com carries a small Vite
  plugin (`vite.config.ts`) that leaves `.wasm` imports for wrangler's bundler to turn into modules.
- `./runtime/nitro`: unwasm's `?module` suffix and Nitro's `raw:` prefix do the same for Nuxt,
  behind `nitro.experimental.wasm`.
- `./runtime/node`: reads the binaries and fonts from disk, for djf.io's prerendered endpoint and
  the package's own tests.

Resolution starts inside this package, so the binaries come from its own tree and no app declares
satori, resvg, or the font package -- except djf.io, whose Vite SSR build externalizes them for the
Node prerender, where the emitted chunk resolves from the app's tree instead.

`ogCard({runtime, ...card})` is the request handler apps mount at `/og/default.png`: it renders once
and keeps the response in the Workers Cache API's default cache (a day's `max-age`), so a burst of
scrapers unfurling one shared link rasterizes it once per edge location.
`ogCards({runtime, card, maxAge?})` is the same handler for a family of cards: `card(request)`
returns the params for the card a request names (revision.city reads the diff out of the path and
asks GitHub for the pull request's public title), or `undefined` for a 404, which is never cached.
Each URL is its own cache entry, and a card may carry its own `maxAge` when the resolver knows
better than the default (a card drawn without the data it asked for keeps a short life).

A cached card outlives the deploy that drew it, so both handlers take `version`: the deployed
version rendering the cards, or a function resolving it per request. Each version keeps its own
cache entries and a deploy starts from an empty card cache instead of serving the previous version's
cards until they expire. On Workers the version is the version metadata binding's id
(`[version_metadata]` in `wrangler.toml`, read through `cloudflare:workers`); revision.city's
`src/deployed-version.ts` is the reference.

satori is held at 0.32: 0.33 added HarfBuzz text shaping whose Emscripten loader reads
`self.location` and compiles wasm from bytes, neither of which works on Workers
(`.github/renovate.json` records the hold).

## Tests

`vitest.config.ts` carries a small plugin that stands in for the bundlers, so the Vite and Nitro
runtime modules run under Vitest exactly as written and every runtime renders a real card in the
suite. `pngSize` on `./png` reads a card's dimensions from the PNG header, which is what each app's
e2e asserts against the size the `og:image:width/height` meta advertises.
