### refactor(revision.city): move the settings switch from Radix to Ark UI

The display settings switches (Backgrounds, Line numbers, Word wrap) now use the Ark UI switch, and
`@radix-ui/react-switch` is removed. This is the first step of the move from Radix to Ark. The
switch now renders its own label, so the call sites no longer need a separate `label` element and
`id`. The switch styles carry over as they were.
