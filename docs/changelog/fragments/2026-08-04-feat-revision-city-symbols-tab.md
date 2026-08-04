### feat(revision.city): read a diff by symbol in the viewer's sidebar

The diffs viewer gets a third sidebar tab, beside Files and Comments, that lists what a diff did to
named things rather than to lines: `Widget.render` modified, `welcome` renamed from `greet`,
`WidgetOptions` added, `dependencies.react` modified. Rows are grouped by file and carry the change
sigil and colors the file tree already uses for Git status, so "added" reads the same in both
panels. Clicking a row scrolls the viewer to that entity -- to its new position, or for a deleted
one to where it used to be -- expanding the file first if it was collapsed.

This is the engine from the previous change wired to a surface. A new `/api/diffs/entity-diff` route
parses both revisions of one file in the worker and answers with the entity diff, so no grammar is
ever shipped to the browser and the answer can be cached per revision pair. It reuses the diff
viewer's own GitHub plumbing, including the HttpOnly session cookie, so no token reaches the client;
signed-out visitors are told that is why the tab is empty rather than shown a blank panel.

Reading a file for symbols costs GitHub requests, so the work is gated twice. Nothing is fetched
until the tab is opened -- viewing a diff and never opening it costs nothing -- and once opened,
requests run four at a time instead of one per file at once, which would open sixty connections on a
sixty-file PR. Results are cached per revision pair for the life of the page, so switching tabs
never repeats a fetch, and a file that fails to read is marked without taking the other files down
with it.

Two supporting changes. `loadGitHubDiffFiles` grew an opt-in `hydrateSingleSided` flag: added and
deleted files previously resolved to empty placeholders, which is right for the viewer (the patch
already carries every line) but would have made an added file look like it declared nothing. The
viewer's own behavior is unchanged. A pure rename is answered without contacting GitHub at all,
since moving a file cannot change the entities inside it.

Verified end to end in a real browser against the production build: four Playwright specs drive the
actual viewer with the GitHub-facing routes stubbed, covering the populated panel, the
fetch-nothing-until-opened gate, scroll-to-symbol, and the signed-out state. 85 unit tests cover the
symbols module, and the existing visual baselines still match.
