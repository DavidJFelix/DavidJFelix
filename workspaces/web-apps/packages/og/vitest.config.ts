import {readFile} from 'node:fs/promises'
import type {Plugin} from 'vitest/config'
import {defineConfig} from 'vitest/config'

// The runtime modules import wasm binaries as compiled modules and font files
// as inlined bytes -- specifiers only a bundler resolves. This plugin stands in
// for the Cloudflare Vite plugin (`.wasm`), Vite (`?inline`), unwasm
// (`?module`) and Nitro (`raw:`) so those modules run under Vitest exactly as
// written, proving the shape each bundler is expected to hand them.
// Virtual ids carry the specifier, never the resolved path: a colon reads as
// a URL scheme to the module runner and a node_modules path gets the module
// externalized to Node's loader, which cannot import these files either way.
const VIRTUAL = '\0og-bundler/'

type AssetKind = 'inline' | 'raw' | 'wasm'

const classify = (source: string): {kind: AssetKind; specifier: string} | undefined => {
  if (source.startsWith('raw:')) return {kind: 'raw', specifier: source.slice('raw:'.length)}
  if (source.endsWith('?inline')) {
    return {kind: 'inline', specifier: source.slice(0, -'?inline'.length)}
  }
  if (source.endsWith('.wasm?module')) {
    return {kind: 'wasm', specifier: source.slice(0, -'?module'.length)}
  }
  if (source.endsWith('.wasm')) return {kind: 'wasm', specifier: source}
  return undefined
}

const bundlerModules = (): Plugin => {
  const files = new Map<string, {kind: AssetKind; file: string}>()
  return {
    name: 'og-bundler-modules',
    enforce: 'pre',
    async resolveId(source, importer) {
      const asset = classify(source)
      if (!asset) return null
      const resolved = await this.resolve(asset.specifier, importer, {skipSelf: true})
      if (!resolved) return null
      const id = `${VIRTUAL}${asset.kind}/${asset.specifier}`
      files.set(id, {kind: asset.kind, file: resolved.id})
      return id
    },
    async load(id) {
      const asset = files.get(id)
      if (!asset) return null
      if (asset.kind === 'wasm') {
        return `import {readFileSync} from 'node:fs'\nexport default new WebAssembly.Module(readFileSync(${JSON.stringify(asset.file)}))`
      }
      const base64 = (await readFile(asset.file)).toString('base64')
      if (asset.kind === 'raw') {
        return `export default Uint8Array.from(atob('${base64}'), (char) => char.charCodeAt(0))`
      }
      return `export default 'data:font/woff;base64,${base64}'`
    },
  }
}

export default defineConfig({
  plugins: [bundlerModules()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.*'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
