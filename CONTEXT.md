# Repository Organization

Language for repository-wide structure and tooling boundaries.

## Language

**Workspace tree**:

A self-contained code subtree isolated from the main repo so its package manager or toolchain can
own a workspace boundary without colliding with a parent workspace.

_Avoid_: Legacy project, archive
