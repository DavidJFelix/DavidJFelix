### ci(web-apps): apply D1 migrations in the production deploy

The production deploy now runs `wrangler d1 migrations apply --remote` before `wrangler deploy` for
each app with a D1 database (revision.city and monicandavid.com). The plan registry names the
database in a new `d1Database` field, and a test checks that it matches each app's wrangler.toml.
Before this, each migration was a manual step, and revision.city's summary comment lock table was
never created in production.
