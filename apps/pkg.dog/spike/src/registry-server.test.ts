import {expect, test} from 'bun:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {$} from 'bun'
import {type ServedRegistry, serveRegistry} from './registry-server.ts'

interface Packument {
  name: string
  'dist-tags': {latest: string}
  versions: Record<
    string,
    {
      dependencies?: Record<string, string>
      dist: {tarball: string; integrity: string; shasum: string}
    }
  >
}

async function registryFixture(): Promise<{
  registry: ServedRegistry
  cleanup: () => Promise<void>
}> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgdog-registry-'))
  const outDir = join(dir, 'out')
  await Bun.write(
    join(outDir, 'demo__pack__a/package.json'),
    JSON.stringify({
      name: '@pkgdog/demo__pack__a',
      version: '2.0.0',
      type: 'module',
      exports: {'.': {default: './a.js'}},
      dependencies: {'@pkgdog/demo__pack__b': '2.0.0'},
    }),
  )
  await Bun.write(join(outDir, 'demo__pack__a/a.js'), 'export const a = 1\n')
  await Bun.write(
    join(outDir, 'demo__pack__b/package.json'),
    JSON.stringify({
      name: '@pkgdog/demo__pack__b',
      version: '2.0.0',
      type: 'module',
      exports: {'.': {default: './b.js'}},
    }),
  )
  await Bun.write(join(outDir, 'demo__pack__b/b.js'), 'export const b = 2\n')

  const registry = await serveRegistry(outDir, join(dir, 'stage'))
  return {
    registry,
    cleanup: async () => {
      registry.stop()
      await rm(dir, {recursive: true, force: true})
    },
  }
}

test('serveRegistry lists every part directory it found', async () => {
  const {registry, cleanup} = await registryFixture()
  expect(registry.packageNames).toEqual(['@pkgdog/demo__pack__a', '@pkgdog/demo__pack__b'])
  await cleanup()
})

test('packuments carry dist-tags, dependencies, and a fetchable dist block', async () => {
  const {registry, cleanup} = await registryFixture()

  const res = await fetch(`${registry.url}/@pkgdog/demo__pack__a`)
  expect(res.status).toBe(200)
  const packument = (await res.json()) as Packument
  expect(packument.name).toBe('@pkgdog/demo__pack__a')
  expect(packument['dist-tags']).toEqual({latest: '2.0.0'})
  const version = packument.versions['2.0.0']
  // npm resolves cross-part deps from this field -- losing it breaks installs.
  expect(version?.dependencies).toEqual({'@pkgdog/demo__pack__b': '2.0.0'})
  expect(version?.dist.integrity).toStartWith('sha512-')
  expect(version?.dist.shasum).toMatch(/^[0-9a-f]{40}$/u)

  await cleanup()
})

test('packuments resolve for URL-encoded names, the form npm actually requests', async () => {
  const {registry, cleanup} = await registryFixture()
  const res = await fetch(`${registry.url}/${encodeURIComponent('@pkgdog/demo__pack__a')}`)
  expect(res.status).toBe(200)
  expect(((await res.json()) as Packument).name).toBe('@pkgdog/demo__pack__a')
  await cleanup()
})

test('tarballs download, match their advertised integrity, and use npm package/ layout', async () => {
  const {registry, cleanup} = await registryFixture()

  const packument = (await (
    await fetch(`${registry.url}/@pkgdog/demo__pack__a`)
  ).json()) as Packument
  const dist = packument.versions['2.0.0']?.dist as Packument['versions'][string]['dist']
  const tarballRes = await fetch(dist.tarball)
  expect(tarballRes.status).toBe(200)
  const bytes = new Uint8Array(await tarballRes.arrayBuffer())

  const sha512 = new Bun.CryptoHasher('sha512').update(bytes).digest('base64')
  expect(`sha512-${sha512}`).toBe(dist.integrity)
  const sha1 = new Bun.CryptoHasher('sha1').update(bytes).digest('hex')
  expect(sha1).toBe(dist.shasum)

  const extractDir = await mkdtemp(join(tmpdir(), 'pkgdog-tarball-'))
  const tgzPath = join(extractDir, 'part.tgz')
  await Bun.write(tgzPath, bytes)
  await $`tar xzf ${tgzPath} -C ${extractDir}`.quiet()
  const unpacked = (await Bun.file(join(extractDir, 'package/package.json')).json()) as {
    name: string
  }
  expect(unpacked.name).toBe('@pkgdog/demo__pack__a')
  expect(await Bun.file(join(extractDir, 'package/a.js')).text()).toBe('export const a = 1\n')
  await rm(extractDir, {recursive: true, force: true})

  await cleanup()
})

test('unknown packages and tarballs return 404 instead of a broken packument', async () => {
  const {registry, cleanup} = await registryFixture()
  expect((await fetch(`${registry.url}/@pkgdog/nope`)).status).toBe(404)
  expect((await fetch(`${registry.url}/@pkgdog/nope/-/2.0.0.tgz`)).status).toBe(404)
  await cleanup()
})
