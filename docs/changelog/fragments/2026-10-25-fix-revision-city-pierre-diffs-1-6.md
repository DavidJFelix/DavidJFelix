### fix(revision.city): move to @pierre/diffs 1.6.1 and its annotation arguments

The Renovate pierre group moves `@pierre/diffs` from 1.5.2 to 1.6.1 and `@pierre/theming` from 1.0.1
to 1.0.2. In 1.6.1, `CodeView` calls `renderAnnotation` with three arguments: the annotation, the
file or file diff, and the item. Before, it gave only the annotation and the item. With only the
version change, the diff viewer reads the file diff as the item and shows no comments. The viewer
now reads its arguments as the `CodeViewAnnotationArgs` type from `@pierre/diffs/react`.

1.6.1 also removes the `ThemeRegistrationResolved` export. The `ThemeLike` object that
`diffThemeSelectionFromInput` registers already fits the `ThemeRegistration` type that
`registerCustomTheme` takes, so the type cast is gone.
