import {cloudflare} from '@cloudflare/vite-plugin'
import {flue, flueWorkerConfig} from '@flue/vite'
import {defineConfig} from 'vite'

// Builds the deployable Flue Worker (Flue 2 dropped `flue build` for Vite).
// This config is the worker build only: `astro build` keeps its own pipeline
// (astro.config.mjs) and runs first, so src/app.ts can import the prebuilt
// Astro worker it hosts. flue() must precede cloudflare() -- it scans the
// 'use agent' modules and hands the generated Worker entry plus per-agent
// Durable Object bindings to the Cloudflare plugin via the config customizer.
// outDir keeps the worker artifact out of Astro's dist/ (client + server).
export default defineConfig({
  plugins: [flue(), cloudflare({config: flueWorkerConfig()})],
  build: {outDir: 'dist-flue'},
})
