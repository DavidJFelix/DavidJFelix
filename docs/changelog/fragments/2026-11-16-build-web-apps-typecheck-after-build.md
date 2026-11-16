### build(web-apps): run each app's typecheck after its build

Each app's `mise run check` ran typecheck at the same time as build. The build writes files that
typecheck reads, so the two could race, as turbo already notes for the root check. Typecheck now
runs after lint, format, test and build finish, in all 12 apps. The header line and the stale test
task description in the app `mise.toml` files now say what is true.
