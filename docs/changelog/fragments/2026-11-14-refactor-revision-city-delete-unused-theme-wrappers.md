### refactor(revision.city): delete unused theme wrappers, patch cache and exports

The diffs viewer loses code that nothing used: the `ThemedFile`, `ThemedFileDiff` and
`ThemedSurface` wrappers, the theme selector, the patch cache, the item version helper,
`getGutterSize` and `docsThemeResolver`. Six helpers in `github-auth.ts` are no longer exported,
because only that file uses them. No change for visitors.
