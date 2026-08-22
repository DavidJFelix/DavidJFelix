### chore(tooling): group the getsentry/warden action into the sentry renovate PR

The sentry group covered the `@sentry/**` npm sdks and the mise-pinned `npm:@sentry/warden` CLI, but
the `getsentry/warden` GitHub action pinned in the Depot workflows fell through to the generic
github-actions batch, so the action SHA and the mise CLI version could drift apart. The rule now
matches the action's package name too, grouping every warden update type across all three managers
into the single sentry PR.
