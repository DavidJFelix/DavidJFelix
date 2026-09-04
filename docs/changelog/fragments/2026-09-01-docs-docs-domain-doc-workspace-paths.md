### docs(docs): point domain docs at the bun workspace app layout

`docs/agents/domain.md` still referenced app contexts and ADRs under the old top-level `apps/`
directory from before the workspace reorganization. Updated every path, including the example
directory tree, to the current `workspaces/web-apps/apps/<app>/` layout, matching `CONTEXT-MAP.md`.
The other `docs/agents/` files were checked and carry no stale paths.
