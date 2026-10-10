import {defineConfig} from 'drizzle-kit'

// This config only generates migrations: `db:generate` compares the schema with
// drizzle/meta and writes the next SQL file into drizzle/. Wrangler applies the
// migrations through `migrations_dir` when wrangler.toml has the D1 binding, so
// this file holds no database credentials.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/reviews/lib/schema.ts',
  out: './drizzle',
})
