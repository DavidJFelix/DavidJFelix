### fix(ravrun): pin `preview_urls = true` so production deploys stop disabling PR previews

ravrun was the only custom-domain worker without an explicit `preview_urls = true` in its
`wrangler.toml`. Deploys sync worker settings declaratively, so each production deploy reverted the
manually enabled dashboard toggle to the routes-present default (off), after which every
`wrangler versions upload --preview-alias` printed no workers.dev URL and CD Preview ravrun failed
at the deploy step. Pinned the setting the same way the davidjfelix.com / monicandavid.com /
startchi.com / revision.city configs already do.
