import {cloudflare} from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// The cloudflare() plugin builds src/server.ts (wrangler.toml `main`) for
// workerd as part of `vite build`, so import.meta.env.VITE_PUBLIC_* is inlined
// into the worker exactly as it is into the client -- the same build env feeds
// both. It also makes `vite preview` serve the worker (the Start server:
// shell rendering + relay routes) in front of the built assets.
export default defineConfig({
  plugins: [
    // The deployed worker IS the Start server (wrangler.toml main =
    // src/server.ts), so the plugin builds it as Vite's 'ssr' environment --
    // the documented Start integration. Start's build-time shell prerender
    // boots `vite preview` against this same worker, which renders the shell
    // rather than 404ing the way a static-relay worker would.
    cloudflare({viteEnvironment: {name: 'ssr'}}),
    // Start in SPA mode: routes render client-side only. The shell -- the
    // root document component, including the theme ScriptOnce -- is
    // prerendered at build to /index.html (the shell writer appends .html to
    // outputPath), which the ASSETS binding serves statically for / and as
    // the single-page-application fallback.
    tanstackStart({spa: {enabled: true, prerender: {outputPath: '/index'}}}),
    viteReact(),
    tailwindcss(),
  ],
})
