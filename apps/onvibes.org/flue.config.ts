import {defineConfig} from '@flue/cli/config'

// Flue owns the deployed Worker and hosts Astro inside it (see src/app.ts).
// `flue build` discovers agents under src/agents and bundles src/app.ts into a
// Cloudflare Worker (with the Durable Objects the agent runtime needs). Output
// goes to dist-flue so it doesn't collide with Astro's dist/ (client + server).
export default defineConfig({
  target: 'cloudflare',
  output: 'dist-flue',
})
