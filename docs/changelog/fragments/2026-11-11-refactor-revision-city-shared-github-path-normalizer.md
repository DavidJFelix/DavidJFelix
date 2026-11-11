### refactor(revision.city): use the shared normalizeGitHubPath in the diff endpoint

The diff endpoint now uses the shared `normalizeGitHubPath` and its private copy is removed. A
direct call to the diff endpoint with a `pull/<n>/changes/<sha>` path now maps to the commit, as the
viewer route already does.
