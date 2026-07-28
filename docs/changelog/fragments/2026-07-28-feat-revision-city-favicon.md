### feat(revision.city): give the site a mark of its own

revision.city shipped without a favicon, so browsers fell back to a blank page glyph in the tab and
in bookmarks -- the one app in the portfolio with nothing to identify it. It now carries Lucide's
`building-2` on a rounded tile, at `public/favicon.svg`, matching how davidjfelix.com, djf.io, and
calendar-visualizer each serve a single SVG mark.

The glyph's paths are copied from `lucide-react`, already a dependency of this app, at their native
24x24 scale so the stroke stays exactly as Lucide draws it; the tile only translates them into a
32x32 box with 4px of padding. Copying rather than importing keeps the mark a static asset the CDN
can serve without the app's module graph, and the file says where to re-copy from if the
dependency's drawing changes.

Two choices are about staying readable at 16px. The tile is filled rather than outlined, because an
outline plus the glyph's own strokes turns to mush at that size; and it inverts with the browser
chrome, because a near-black tile disappears into a dark tab strip. The two colors are the app's own
scheme colors, the ones the diffs theme bootstrap already writes to `<meta name="theme-color">`.

The `<link>` is declared on the root route, so `/diffs` inherits the mark while still overriding its
own title and description. End-to-end tests cover both halves of that: the link is present on `/`
and on `/diffs`, and `/favicon.svg` answers 200 as `image/svg+xml` rather than the SPA fallback that
a build which dropped `public/` would serve.

The mark now also appears in the page, leading the name at the top left of each of the three
surfaces that have one: the landing header, the diffs home heading, and the diffs viewer header.
They share a `SiteMark` component, which imports `building-2` from `lucide-react` rather than
re-copying it, because on this side there is a module graph to import from.

In the page it drops the two things the tab needs. A filled tile beside a wordmark reads as noise at
page size, and a hard-coded black or white would clash inside the diffs header, whose foreground
comes from whichever Shiki theme is active -- so the glyph keeps `currentColor` and is sized in
`em`. That is what lets all three placements sit at different font sizes on differently-colored
chrome while passing no props at all.

A unit test asserts that the paths Lucide renders are the ones committed in `public/favicon.svg`,
which turns that file's "re-copy if the drawing changes" note into something CI enforces -- an
upgrade that redraws the glyph would otherwise move only the imported half, leaving the tab and the
header showing different buildings. The end-to-end tests measure the mark against the text node
beside it, rather than the element wrapping them both, so a placement that trails the name instead
of leading it actually fails.
