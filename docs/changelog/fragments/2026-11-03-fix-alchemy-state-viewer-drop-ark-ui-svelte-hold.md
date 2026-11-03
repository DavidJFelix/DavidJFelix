### fix(alchemy-state-viewer): drop the @ark-ui/svelte hold

`@ark-ui/svelte` 5.25.1 uses relative imports in its `dist` again, so the alchemy-state-viewer build
and typecheck pass on it. This change removes the Renovate rule that held the package below 5.25.0.
alchemy-state-viewer and monicandavid.com go back to a caret range, `^5.25.1`. The range starts at
5.25.1 because 5.25.0 is still on npm with the `$lib/...` imports.
