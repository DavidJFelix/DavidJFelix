### docs(repo): plan the move from CI path filters to Turborepo + Depot Cache

New task project `depot-caching-strategy`: with `packages/theme` extracted, the per-project path
filters in `.depot/workflows/` stop being an honest encoding of what a change affects -- the
extraction added `packages/theme/**` to 27 workflow files by hand, and nothing checks those lists.
The plan replaces them with graph-computed work selection -- root bun workspace, Turborepo task
graph, Depot Cache as the remote cache (native Turborepo support, built into Depot CI) -- collapsing
the thirteen per-project CI workflows into one turbo-driven workflow and driving preview/deploy
matrices from `turbo ls --affected`. Supersedes the path-filter surgery half of
ci-pipeline-efficiency; the plan flags the decisions David must own first, chiefly where the
workspace root lives -- at the repo root (reversing the documented "no repo-root workspace" rule
while keeping `workspaces/` trees excluded) or nested under a tree like `workspaces/web-apps/`
(keeping the rule but moving `apps/`, `packages/`, and the shared configs, which turbo cannot hash
from outside its workspace root).
