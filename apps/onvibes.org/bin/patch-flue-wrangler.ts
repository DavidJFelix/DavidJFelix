/// <reference types="bun" />
// `flue build --target cloudflare` merges wrangler.toml into its deployable
// config (dist-flue/onvibes_org/wrangler.json) but drops the [assets] block:
// the Cloudflare Vite plugin only carries assets it built itself, and Astro's
// dist/client is produced outside that pipeline. Without the ASSETS binding the
// deployed Worker serves no static site -- every prerendered page and hashed
// client file 404s. Re-inject the assets config here, with the directory
// re-relativized to the emitted config's location. Runs as the last step of
// `pnpm run build`.

import {existsSync} from 'node:fs'

const CONFIG_PATH = 'dist-flue/onvibes_org/wrangler.json'
const ASSETS_DIR = 'dist/client'

const file = Bun.file(CONFIG_PATH)
if (!(await file.exists())) {
  console.error(
    `::error::${CONFIG_PATH} is missing -- run \`flue build --target cloudflare\` first`,
  )
  process.exit(1)
}
// Fail here with a clear message rather than emitting a working-looking config
// whose assets binding points at nothing (e.g. astro build skipped or failed).
if (!existsSync(ASSETS_DIR)) {
  console.error(`::error::${ASSETS_DIR} is missing -- run \`astro build\` first`)
  process.exit(1)
}

const config = await file.json()
config.assets = {
  // Relative to dist-flue/onvibes_org/, where the config lives.
  directory: '../../dist/client',
  binding: 'ASSETS',
  // Cloudflare serves matching assets before invoking the Worker; the agent API
  // must always reach the Worker (and the Flue routes inside src/app.ts).
  run_worker_first: ['/api/*'],
}
await Bun.write(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
console.log(`patched ${CONFIG_PATH}: assets binding -> dist/client, run_worker_first /api/*`)
