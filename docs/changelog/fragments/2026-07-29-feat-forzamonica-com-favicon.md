### feat(forzamonica.com): give the site an fm mark drawn from its own h1

forzamonica.com shipped without a favicon, so the tab and bookmarks fell back to a blank page glyph.
It now carries `public/favicon.svg`: the "fm" of forzamonica, in the letterforms the landing page's
own h1 renders, matching how davidjfelix.com, djf.io, calendar-visualizer, and revision.city each
serve a single SVG mark.

The two paths are the `f` and `m` outlines of Newsreader Italic, taken from the same woff2 that
`src/styles.css` self-hosts, instantiated at the settings the h1 resolves to: weight 500 from
`textStyle: displayXl`, and optical size 44 because that text style sets 44px and browsers default
to `font-optical-sizing: auto`. The optical size is the part worth pinning down. Newsreader redraws
the pair as it moves -- the ink box of "fm" goes from 1.26 wide-to-tall at the font's default 18 to
1.30 at 44 -- so guessing would have put a visibly different `f` in the tab than the one above the
page. Measuring Chromium's own rasterization at 44px confirmed which cut the h1 gets before the
outlines were extracted. The pair keeps the font's own f/m kern, and the combined ink box fills the
32x32 tile with 1px to spare.

Outlines rather than a `<text>` element, because browsers render an SVG favicon in a context that
loads no external resources: a `font-family` reference would silently fall back to the system serif,
which is the one thing this mark is meant not to be. The file says where to re-extract from if the
font package ever redraws the italic.

Two choices follow the existing marks. No tile, matching davidjfelix.com and djf.io, since the
letterforms are the mark and a tile would only crop them; and the fill inverts with the browser
chrome, because the design system's ink on a dark tab strip would disappear. Both colors are the
app's own tokens from `panda.config.ts`.

The `<link>` is declared on the root route, so the pre-launch landing at `/` and the storefront
chrome under `/monica` inherit it while still overriding their own titles. End-to-end tests cover
both halves: the link is present on `/` and on `/monica`, and `/favicon.svg` answers 200 as
`image/svg+xml` rather than the SPA fallback document that a build which dropped `public/` would
serve.
