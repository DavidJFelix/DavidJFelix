import {realpathSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {expect, test} from 'vitest'

const PiAi = '@earendil-works/pi-ai'

interface ResolvePackageDirParams {
  fromDir: string
  pkg: string
}

// Node's directory walk: climb from `fromDir` looking for node_modules/<pkg>,
// then canonicalize through pnpm's symlink so two logical paths that share a
// store entry compare equal. Both packages are ESM-only with no `require`
// export condition, so require.resolve cannot do this.
function resolvePackageDir({fromDir, pkg}: ResolvePackageDirParams): string {
  let dir = fromDir
  for (;;) {
    try {
      return realpathSync(join(dir, 'node_modules', pkg))
    } catch {
      const parent = dirname(dir)
      if (parent === dir) {
        throw new Error(`${pkg} is not resolvable from ${fromDir}`)
      }
      dir = parent
    }
  }
}

// app.ts registers the faux echo provider on pi-ai's API-transport registry,
// which is module state. @flue/runtime reads that registry when it resolves
// "onvibes/assistant". Two copies of pi-ai means two registries, and the agent
// endpoint 500s with "No API provider registered for api: onvibes" -- a runtime
// failure only the smoke gate catches, and only after a workerd boot. pnpm keys
// pi-ai by its resolved peer context, so a lockfile refresh can split it
// (#339 did, via @modelcontextprotocol/sdk); the override in
// pnpm-workspace.yaml holds it together and this asserts the override still works.
test('app.ts and @flue/runtime resolve the same @earendil-works/pi-ai instance', () => {
  const appDir = dirname(fileURLToPath(import.meta.url))
  const flueDir = resolvePackageDir({fromDir: appDir, pkg: '@flue/runtime'})

  const appPiAi = resolvePackageDir({fromDir: appDir, pkg: PiAi})
  const fluePiAi = resolvePackageDir({fromDir: flueDir, pkg: PiAi})

  // Vitest truncates both sides of a long string diff, so spell the split out.
  expect(fluePiAi, `app.ts gets ${appPiAi}, @flue/runtime gets ${fluePiAi}`).toBe(appPiAi)
})
