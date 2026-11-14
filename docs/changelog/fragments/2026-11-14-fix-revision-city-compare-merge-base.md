### fix(revision.city): read a compare's old side at the merge base

On a GitHub compare where the base branch moved on after the head branch split off, expanded context
and the Symbols tab read the old file at the base tip, but the patch starts at the merge base. They
now read the old file at the merge base for a three-dot or one-ref compare, as a pull request does. A
two-dot compare still reads the base tip.
