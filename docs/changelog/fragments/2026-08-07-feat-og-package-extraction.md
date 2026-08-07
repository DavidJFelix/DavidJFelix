### feat(og): extract the OpenGraph integration into @davidjfelix/og and wire it into every app

djf.io was the only app with a real social-sharing story -- og:/twitter: meta pairs in its layout
and a satori/sharp title-card endpoint -- and every other app had at most a title and description.
The integration now lives in `packages/og` and every app in the workspace consumes it.

The package is one tag builder plus the card renderer. `ogTags` returns plain
`{property|name, content}` attribute objects and emits only the fields it is given, which is the
whole framework story: Astro and Svelte spread them onto `<meta>`, TanStack Start passes them in
`head()` meta (they are members of its MetaDescriptor union, and head merging dedupes by
name/property with the leaf-most route winning, so root-level site defaults compose with per-route
overrides), and Nuxt hands them to `useHead`. No per-framework adapters were needed -- the shape is
the abstraction. `renderOgImage` on the `./image` subpath is djf.io's card verbatim with the badge
and byline parameterized; it stays node-only and build-time-only.

djf.io's layout and endpoint became thin callers with byte-identical output (its layout tests and
seo e2e suite are the proof). The image routes gained their own cases: the renderer is proven
deterministic, param-sensitive, and safe for markup characters in frontmatter; a contract test pins
the endpoint to the default card plus one route per blog post carrying that post's own frontmatter,
rendered as real 1200x630 PNGs; and the e2e now reads each served card's IHDR to assert the
dimensions the og:image:width/height meta advertises. The five TanStack apps carry site defaults on
their root routes, with forzamonica.com's eight titled routes and revision.city's two overriding
their own og/twitter pairs; the other Astro apps, the SvelteKit apps, and pkg.dog render the pairs
from their existing title/description constants. Only djf.io generates card images so far -- the
renderer is parameterized and waiting for the next app that wants one.

Two latent workspace faults surfaced and are fixed along the way. `astro check` requires
`typescript` resolvable from the app root, which bun's isolated linker never provides unless the app
declares it -- all four Astro apps now do (6.0.3, the JS-based line the language server can drive).
And onvibes.org type-failed on two physical hono copies (`app.route('/api', flue())` mixing the
app's 4.12.34 with flue's 4.12.29), so hono joins the root overrides that force one copy, documented
beside its siblings in bunfig.toml.
