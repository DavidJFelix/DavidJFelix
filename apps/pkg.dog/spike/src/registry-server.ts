import {cp, mkdir, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {$} from 'bun'

export interface ServedRegistry {
  url: string
  packageNames: string[]
  stop(): void
}

interface PackedPart {
  packageJson: Record<string, unknown> & {name: string; version: string}
  tarball: Uint8Array
  integrity: string
  shasum: string
}

/**
 * pkg.dog as a registry, in miniature: pack every emitted part into an
 * npm-layout tarball and serve packuments + tarballs over the npm protocol,
 * so any stock npm/bun/pnpm client can install decomposed parts by pointing
 * the part scope at this URL. The production shape is this exact protocol on
 * the pkg.dog Worker.
 */
export async function serveRegistry(outDir: string, stageDir: string): Promise<ServedRegistry> {
  const packed = new Map<string, PackedPart>()
  await rm(stageDir, {recursive: true, force: true})
  for await (const entry of new Bun.Glob('*/package.json').scan({cwd: outDir})) {
    const partDir = join(outDir, entry, '..')
    const packageJson = (await Bun.file(join(outDir, entry)).json()) as PackedPart['packageJson']
    const stage = join(stageDir, packageJson.name.split('/')[1] as string)
    await mkdir(stage, {recursive: true})
    await cp(partDir, join(stage, 'package'), {recursive: true})
    const tgzPath = join(stage, 'part.tgz')
    await $`tar czf ${tgzPath} -C ${stage} package`.quiet()
    const tarball = new Uint8Array(await Bun.file(tgzPath).arrayBuffer())
    const sha512 = new Bun.CryptoHasher('sha512').update(tarball).digest('base64')
    const shasum = new Bun.CryptoHasher('sha1').update(tarball).digest('hex')
    packed.set(packageJson.name, {packageJson, tarball, integrity: `sha512-${sha512}`, shasum})
  }

  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(req) {
      const pathname = decodeURIComponent(new URL(req.url).pathname)
      const tarballMatch = pathname.match(/^\/(.+)\/-\/[^/]+\.tgz$/u)
      if (tarballMatch) {
        const part = packed.get(tarballMatch[1] as string)
        if (!part) return new Response('not found', {status: 404})
        return new Response(part.tarball, {
          headers: {'content-type': 'application/octet-stream'},
        })
      }
      const part = packed.get(pathname.slice(1))
      if (!part) return new Response('not found', {status: 404})
      const {name, version} = part.packageJson
      const packument = {
        name,
        'dist-tags': {latest: version},
        versions: {
          [version]: {
            ...part.packageJson,
            dist: {
              tarball: `http://127.0.0.1:${String(server.port)}/${name}/-/${version}.tgz`,
              integrity: part.integrity,
              shasum: part.shasum,
            },
          },
        },
      }
      return new Response(JSON.stringify(packument), {
        headers: {'content-type': 'application/json'},
      })
    },
  })

  return {
    url: `http://127.0.0.1:${String(server.port)}`,
    packageNames: [...packed.keys()].toSorted((a, b) => a.localeCompare(b, 'en')),
    stop: () => void server.stop(true),
  }
}
