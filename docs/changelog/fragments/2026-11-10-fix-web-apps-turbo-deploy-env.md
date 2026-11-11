### fix(web-apps): pass deploy build variables through turbo

The deploy build sets `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` and
`STANDARD_SITE_RESOLVE`. But turbo runs the build in strict environment mode, and it removes each
variable that the task does not declare. Thus the Astro apps did not upload their Sentry source
maps, and djf.io posts had no standard.site document link. The `build` task now declares the three
plain values in `env`, so they are in the cache hash. It declares the token in `passThroughEnv`, so
the token reaches the build but stays out of the hash.
