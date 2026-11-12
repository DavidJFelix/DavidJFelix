### fix(revision.city): turn off Version URLs on the production worker

The production worker config set `preview_urls = true`, so each production version could also answer
on its own public workers.dev host. Those hosts use the production database, Workflow, and secrets,
but they are outside the revision.city zone and its rate limit rule, and Workers Logs does not
record them. Nothing uses them: since August, previews upload as versions of the dev worker, which
keeps its own `preview_urls = true`. The config now sets `false`, so the next production deploy
turns off Version URLs and any `pr-<N>` aliases that remain from before August. The old comment said
that previews need the setting; the new comment says why the key stays and is `false`.
