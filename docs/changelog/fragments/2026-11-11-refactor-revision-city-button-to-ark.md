### refactor(revision.city): move the button slot from Radix to Ark UI

`Button` now renders through Ark's `ark.button`, which gives the same `asChild` behavior that the
Radix `Slot` gave, and `@radix-ui/react-slot` is removed. This is the second step of the move from
Radix to Ark. The call sites do not change.
