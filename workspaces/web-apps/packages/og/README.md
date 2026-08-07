# @davidjfelix/og

The OpenGraph integration extracted from djf.io as a package: one tag builder whose output every
framework in the workspace consumes directly, plus the satori/sharp title-card renderer behind
djf.io's prerendered `/og/*.png` endpoint. Consumed as a workspace dependency; apps import raw
TypeScript source (no build step -- every consumer bundles with Vite).

| Subpath   | Contents                                                               |
| --------- | ---------------------------------------------------------------------- |
| `.`       | `ogTags` -- OpenGraph/Twitter meta tags as plain attribute objects     |
| `./image` | `renderOgImage` -- the 1200x630 PNG title card (node-only, build-time) |

`ogTags` emits only the fields it is given, so a site-level call carries the defaults and a
page-level call overrides just its own fields wherever the framework merges heads. `ogImageSize`
(1200x630) is exported from the root so meta tags and the renderer agree.

## Per-framework usage

Every entry is `{property, content}` or `{name, content}`, which all four frameworks take as-is.

Astro -- spread onto `<meta>` in a layout's head:

```astro
{ogTags({title, description, type: 'website', siteName: 'djf.io'}).map((tag) => <meta {...tag} />)}
```

TanStack Start -- the shapes are members of `MetaDescriptor`, and head merging dedupes by
name/property with the leaf-most route winning, so root defaults and per-route overrides compose:

```ts
head: () => ({meta: [{title: 'About'}, ...ogTags({title: 'About'})]})
```

SvelteKit -- render inside `svelte:head`:

```svelte
{#each ogTags({title, description}) as tag}
  <meta {...tag} />
{/each}
```

Nuxt -- pass to unhead:

```ts
useHead({title, meta: ogTags({title, description})})
```

## The title card

`renderOgImage({title, description, siteName, author, date?})` returns a PNG `Buffer`: satori lays
out the card (Inter, resolved from the installed @fontsource package), sharp rasterizes it. It is
node-only and belongs in build-time code paths -- a prerendered endpoint or a static build step --
never in browser or worker bundles.
