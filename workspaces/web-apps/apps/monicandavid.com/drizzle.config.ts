import {defineConfig} from 'drizzle-kit'

// drizzle-kit only discovers its config at the package root, so this sits
// here rather than in .config/ (a Tier-2 tool per configuration-style.md).
//
// Only migration generation is wired: `db:generate` diffs the schema against
// drizzle/meta and writes the next SQL file into drizzle/. Applying migrations
// is wrangler's job (`wrangler d1 migrations apply` reads the same directory
// through `migrations_dir` in wrangler.toml), so no database credentials live
// here.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
})
