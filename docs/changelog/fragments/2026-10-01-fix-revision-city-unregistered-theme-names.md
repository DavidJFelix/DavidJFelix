### fix(revision.city): fall back to the default when a stored theme name is not in the catalog

The theme controller loaded the light and dark theme names from localStorage without checking them,
so a name the catalog no longer has (renamed, removed, or edited by hand) went to diffs, whose
highlighter preload throws "No valid theme loader registered" and leaves the code view without
syntax colors. Stored names that the catalog does not know now fall back to the catalog defaults,
with a test for that case. The themed `CodeView` override test also used the unregistered fixture
names `next-light`/`next-dark`, which logged the same error to stderr on every run; it now uses the
registered `pierre-light`/`pierre-dark` themes.
