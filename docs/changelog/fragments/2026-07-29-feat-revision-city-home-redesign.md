### feat(revision.city): redesign the home page around the diffs theme

The home page was the one page that ignored the site's visual language: hard-coded light-only grays
on a white body, system fonts, and no reaction to the color scheme the /diffs pages resolve and
persist -- stepping from a dark viewer back to the front door flashed a stark white page. It also
sold Reviews as a peer feature card when reviews (and the repositories they need) do not exist yet.

The home route now loads the same diffs.css theme contract and pre-paint scheme bootstrap as the
/diffs layout, so both pages share fonts, surfaces, and light/dark behavior. The bootstrap script
moved to `src/diffs/lib/theme-bootstrap.ts` so both route heads inline one copy; the move also fixes
its theme-color step, which referenced an imported helper that does not exist in the inline script's
scope and so silently threw before setting the meta. Content-wise the page is now a front door for
the one part of the city that is open: the feature-card grid is gone, and status is told in diff
notation -- an added line for diffs that links into the viewer, with reviews and repos as context
lines that have not landed -- followed by a single call-to-action card into /diffs. The visual
baseline now covers dark as well as light.
