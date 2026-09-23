import {readFile} from 'node:fs/promises'
import {basename, dirname, relative} from 'node:path'
import {sveltekit} from '@sveltejs/kit/vite'
import type {Plugin} from 'vite'
import {defineConfig, normalizePath} from 'vite'

// adapter-cloudflare hands wrangler an unbundled worker (_worker.js imports the
// Vite SSR output as-is), and wrangler's own bundler turns a `.wasm` import
// into a WebAssembly module uploaded with the Worker -- the only form Workers
// accept, since they refuse to compile wasm from bytes at runtime. Vite has no
// such rule, so this plugin keeps every `.wasm` import external in the SSR
// build, copies the binary into the server output, and points the import at
// it. The share card's satori and resvg modules (@davidjfelix/og/runtime/vite)
// are what ride through it.
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
  plugins: [sveltekit(), wasmModules()],
})

export default config
