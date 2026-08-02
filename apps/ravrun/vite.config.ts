import {cloudflare} from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import {TanStackRouterVite} from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import {defineConfig, type Plugin} from 'vite'
// Relative path rather than the @davidjfelix/theme specifier: Vite inlines
// relative imports when it bundles this config, while a bare specifier would
// be left for Node to load at config time -- and Node refuses to type-strip
// raw TS inside node_modules. Same file either way; the app's file:
// dependency hard-links it.
import {createThemeBootstrapScript} from '../../packages/theme/src/bootstrap'

// Injects the pre-paint color-scheme bootstrap as the first <head> script so
// the page never flashes the wrong scheme. ravrun has no SSR document to
// stringify the script into (the Start apps ship it through ScriptOnce), so
// index.html gets it here, in dev and build alike, generated from the same
// typed source as every other consumer.
function themeBootstrap(): Plugin {
  return {
    name: 'theme-bootstrap',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: createThemeBootstrapScript({storageKey: 'theme'}),
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// The cloudflare() plugin builds src/worker.ts (wrangler.toml `main`) for workerd
// as part of `vite build`, so import.meta.env.VITE_PUBLIC_* is inlined into the
// worker exactly as it is into the client -- the same build env feeds both. It
// also makes `vite preview` serve the worker (relay routes + SPA assets).
export default defineConfig({
  plugins: [themeBootstrap(), cloudflare(), TanStackRouterVite({}), react(), tailwindcss()],
})
