### ci(web-apps): smoke each app's production site after its deploy

The production deploy ended at `wrangler deploy`, so nothing fetched the live site, and a broken
deploy showed up first as a visitor report. The registry (`bin/plan-affected-apps.ts`) now has a
production URL for each app that names a custom domain in its `wrangler.toml`. After the deploy, the
deploy job runs `bin/smoke-url.ts` against that URL. Seven apps are checked: davidjfelix.com,
monicandavid.com, onvibes.org, pkg.dog, ravrun, revision.city and startchi.com. revision.city now
smokes `/` and `/diffs`, on previews too. A failed smoke marks the job red and does not roll back.
