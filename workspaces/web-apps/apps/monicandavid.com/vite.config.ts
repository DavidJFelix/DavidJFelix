import {readFile} from 'node:fs/promises'
import {basename, dirname, relative} from 'node:path'
import adapter from '@sveltejs/adapter-cloudflare'
import {sveltekit} from '@sveltejs/kit/vite'
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import type {Plugin} from 'vite'
import {defineConfig, normalizePath} from 'vite'

// adapter-cloudflare gives wrangler the Vite SSR output without a bundle step.
// Only wrangler's bundler turns a `.wasm` import into a module that Workers
// accept. So this plugin keeps each `.wasm` import external in the SSR build,
// copies the binary into the server output, and points the import at the copy.
// The share card runtime (@davidjfelix/og/runtime/vite) needs it.
const WASM_IMPORT = /__wasm_module__(\/[^'"]+\.wasm)/g

const wasmModules = (): Plugin => ({
  name: 'wasm-modules',
  enforce: 'pre',
  applyToEnvironment: (environment) => environment.name === 'ssr',
  async resolveId(source, importer) {
    if (!source.endsWith('.wasm')) return null
    const resolved = await this.resolve(source, importer, {skipSelf: true})
    return resolved && {id: `__wasm_module__${resolved.id}`, external: true}
  },
  async renderChunk(code, chunk) {
    let output = code
    for (const [token, file] of code.matchAll(WASM_IMPORT)) {
      const emitted = this.getFileName(
        this.emitFile({type: 'asset', name: basename(file), source: await readFile(file)}),
      )
      const importPath = normalizePath(relative(dirname(chunk.fileName), emitted))
      output = output.replaceAll(token, importPath.startsWith('.') ? importPath : `./${importPath}`)
    }
    return output === code ? null : {code: output, map: null}
  },
})

const config = defineConfig({
  plugins: [sveltekit({adapter: adapter(), preprocess: vitePreprocess()}), wasmModules()],
})

export default config
