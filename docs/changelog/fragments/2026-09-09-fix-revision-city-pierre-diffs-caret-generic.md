### fix(revision.city): adopt the `Caret` generic from @pierre/diffs 1.4

`@pierre/diffs` 1.4 added an in-place editor, and with it a second `Caret` type parameter on
`CodeViewHandle`, `CodeViewOptions`, `CodeViewProps`, `FileProps`, and `FileDiffProps`. The
component functions default it to `undefined`, but the exported types do not, so every
single-argument use in revision.city stopped compiling and the same unresolved generics surfaced as
`any`-override lint errors. The app never opens an edit session, so the caret type is pinned to
`undefined` once, as a `DiffsViewerHandle` alias beside `CommentMetadata`, and the `Themed*`
wrappers gain and forward a defaulted `Caret` parameter so they keep the library's full signature.
