import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {$} from 'bun'

export interface UpstreamPackage {
  /** JSR name, e.g. `@std/collections` */
  jsrName: string
  /** npm-compat name on npm.jsr.io, e.g. `@jsr/std__collections` */
  npmName: string
  version: string
  /** Absolute path to the extracted `package/` directory */
  dir: string
  packageJson: UpstreamPackageJson
}

export interface UpstreamPackageJson {
  name: string
  version: string
  license?: string
  homepage?: string
  dependencies?: Record<string, string>
  exports: Record<string, {types?: string; default: string} | string>
}

const JSR_NPM_REGISTRY = 'https://npm.jsr.io'

/** `@std/collections` -> `@jsr/std__collections` (JSR npm-compat naming). */
export function toNpmCompatName(jsrName: string): string {
  const match = jsrName.match(/^@([^/]+)\/(.+)$/u)
  if (!match) throw new Error(`not a scoped JSR name: ${jsrName}`)
  return `@jsr/${match[1]}__${match[2]}`
}

/** Fetch registry metadata, download the tarball, and extract it under workDir. */
export async function fetchUpstream(
  jsrName: string,
  workDir: string,
  version?: string,
): Promise<UpstreamPackage> {
  const npmName = toNpmCompatName(jsrName)
  const metaRes = await fetch(`${JSR_NPM_REGISTRY}/${npmName}`)
  if (!metaRes.ok) throw new Error(`registry metadata ${metaRes.status} for ${npmName}`)
  const meta = (await metaRes.json()) as {
    'dist-tags': Record<string, string>
    versions: Record<string, {dist: {tarball: string}}>
  }
  const resolved = version ?? meta['dist-tags'].latest
  const versionMeta = meta.versions[resolved]
  if (!versionMeta) throw new Error(`version ${resolved} not found for ${npmName}`)

  await mkdir(workDir, {recursive: true})
  const tarballPath = join(workDir, `${resolved}.tgz`)
  const tarballRes = await fetch(versionMeta.dist.tarball)
  if (!tarballRes.ok) throw new Error(`tarball ${tarballRes.status} for ${npmName}@${resolved}`)
  await Bun.write(tarballPath, tarballRes)
  await $`tar xzf ${tarballPath} -C ${workDir}`.quiet()

  const dir = join(workDir, 'package')
  const packageJson = (await Bun.file(join(dir, 'package.json')).json()) as UpstreamPackageJson
  return {jsrName, npmName, version: resolved, dir, packageJson}
}
