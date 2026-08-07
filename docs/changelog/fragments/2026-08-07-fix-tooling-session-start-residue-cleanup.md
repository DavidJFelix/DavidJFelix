### fix(tooling): purge pre-workspace residue in the session-start hook

Cloud containers created before the move to `workspaces/web-apps/` ran the hook's old per-project
install loop, which left ~3GB of untracked `node_modules` and Panda codegen output under repo-root
`apps/`; updating the working copy removed the tracked files but not that residue, so every later
session tripped the stop hook's untracked-files check and agents kept reporting a mystery `apps/`
directory. The hook now deletes repo-root `apps/` and `packages/` when `git ls-files` shows nothing
tracked there -- true for the current layout, false for any pre-move checkout, so real trees are
never touched. Drop the step once no container created before 2026-08-04 remains.
