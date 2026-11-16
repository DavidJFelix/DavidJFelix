### fix(revision.city): report a renamed symbol container once

When the Symbols tab pairs a renamed class or a renamed JSON or YAML key, the members inside it now
pair by identity under the new name. A member that did not change gives no row, and an edited member
gives a `modified` row. Before, a class rename with five untouched methods gave six rows, and a
renamed `devDependencies` key with six keys gave seven.
