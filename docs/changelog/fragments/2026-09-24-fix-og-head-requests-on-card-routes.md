### fix(og): answer HEAD on the share card routes

A HEAD request to a share card route answered 500 with a JSON error body while GET served the PNG:
verified on revision.city in production and reproduced on every TanStack Start app and on
davidjfelix.com; pkg.dog answered the HTML document instead. Some link scrapers and CDNs probe an
image with HEAD before fetching it, so the card could go missing from an unfurl. Two causes.
TanStack Start, Astro, and SvelteKit already forward a HEAD to the GET handler, but `ogCard` keyed
the Workers cache by the incoming request, and the Cache API refuses to `put` under a non-GET
request (and never matches one), so a HEAD on a cold cache threw. Nuxt's Nitro router has no
HEAD-to-GET fallback at all, so the `.get.ts` route never saw the request and it fell through to the
page renderer.

`ogCard` and `ogCards` now key the cache by a GET request built from the URL whatever the incoming
method, so a HEAD reads and fills the same entry its GET would, and answer a HEAD with GET's status
and headers and no body. The rendered response carries an explicit `Content-Length`, so both methods
report the PNG's size from the fresh and the cached path -- except behind Nuxt, whose unenv fetch
bridge deletes the header from every HEAD response after the handler has set it. The TanStack Start
routes register `HEAD` beside `GET` rather than lean on the framework's fallback (revision.city's
per-diff cards at `/og/diffs/<path>.png` included), pkg.dog gains a `default.png.head.ts` beside the
`.get.ts`, and Astro and SvelteKit keep their `GET` export, which each forwards a HEAD to. Every
app's e2e now also probes its cards with HEAD, djf.io's prerendered cards included.
