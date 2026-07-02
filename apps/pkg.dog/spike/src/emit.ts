import {mkdir} from 'node:fs/promises'
import {dirname, join, normalize} from 'node:path'
import type {DecomposePlan, Part} from './decompose.ts'
import {resolveRelative, scanRuntimeModule, scanTypesModule} from './module-graph.ts'
import type {UpstreamPackage} from './registry.ts'

export interface EmittedPart {
  part: Part
  dir: string
}

/**
 * Write each planned part as an installable package under outDir. Member
 * files keep their package-relative paths so intra-part relative imports
 * survive; imports that cross a part boundary are rewritten to the owning
 * part's published specifier.
 */
export async function emitParts(
  plan: DecomposePlan,
  upstream: UpstreamPackage,
  outDir: string,
): Promise<EmittedPart[]> {
  const upstreamLicense = Bun.file(join(upstream.dir, 'LICENSE'))
  const hasLicenseFile = await upstreamLicense.exists()

  const emitted: EmittedPart[] = []
  for (const part of plan.parts) {
    const dir = join(outDir, part.name.split('/')[1] as string)
    await mkdir(dir, {recursive: true})

    for (const runtimePath of part.modules) {
      // The _dist/ mirror is a guess; a module may ship no declaration file.
      const typesPath = typesPathOf(part, plan, runtimePath)
      const hasTypes =
        typesPath !== undefined && (await Bun.file(join(upstream.dir, typesPath)).exists())
      for (const filePath of [runtimePath, ...(hasTypes ? [typesPath] : [])]) {
        const source = await Bun.file(join(upstream.dir, filePath)).text()
        const rewritten = rewriteCrossPartImports(source, filePath, part, plan)
        const target = join(dir, filePath)
        await mkdir(dirname(target), {recursive: true})
        await Bun.write(target, rewritten)
      }
    }

    await Bun.write(
      join(dir, 'package.json'),
      `${JSON.stringify(partPackageJson(part, upstream), null, 2)}\n`,
    )
    if (hasLicenseFile) await Bun.write(join(dir, 'LICENSE'), upstreamLicense)
    emitted.push({part, dir})
  }
  return emitted
}

function typesPathOf(part: Part, plan: DecomposePlan, runtimePath: string): string | undefined {
  for (const entry of Object.values(part.exportsMap)) {
    if (entry.runtime === runtimePath && entry.types !== undefined) return entry.types
  }
  const mirror = normalize(join('_dist', runtimePath.replace(/\.js$/u, '.d.ts')))
  return plan.moduleToPart[runtimePath] === part.name ? mirror : undefined
}

/** Replace specifiers that resolve to modules owned by other parts. */
export function rewriteCrossPartImports(
  source: string,
  filePath: string,
  part: Part,
  plan: DecomposePlan,
): string {
  const specifiers = filePath.endsWith('.d.ts')
    ? scanTypesModule(source)
    : scanRuntimeModule(source).specifiers
  let result = source
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue
    const resolved = runtimeTargetOf(resolveRelative(filePath, specifier), plan)
    if (resolved === undefined) continue
    const owner = plan.moduleToPart[resolved]
    if (owner === undefined || owner === part.name) continue
    const replacement = plan.moduleSpecifier[resolved]
    if (replacement === undefined) continue
    result = result
      .replaceAll(`"${specifier}"`, `"${replacement}"`)
      .replaceAll(`'${specifier}'`, `'${replacement}'`)
  }
  return result
}

/** Map a resolved file path (runtime or types) back to its runtime module path. */
function runtimeTargetOf(resolved: string, plan: DecomposePlan): string | undefined {
  if (plan.moduleToPart[resolved] !== undefined) return resolved
  const fromTypes = normalize(resolved)
    .replace(/^_dist\//u, '')
    .replace(/\.d\.ts$/u, '.js')
  return plan.moduleToPart[fromTypes] !== undefined ? fromTypes : undefined
}

function partPackageJson(part: Part, upstream: UpstreamPackage): Record<string, unknown> {
  const exportsOut: Record<string, {types?: string; default: string}> = {}
  for (const [subpath, entry] of Object.entries(part.exportsMap)) {
    exportsOut[subpath] = {
      ...(entry.types === undefined ? {} : {types: `./${entry.types}`}),
      default: `./${entry.runtime}`,
    }
  }

  const dependencies: Record<string, string> = {}
  for (const dep of part.partDeps) dependencies[dep] = upstream.version
  for (const external of part.externals) {
    const packageName = externalPackageName(external)
    dependencies[packageName] = upstream.packageJson.dependencies?.[packageName] ?? '*'
  }

  return {
    name: part.name,
    version: upstream.version,
    type: 'module',
    description: `${describeSubpaths(part)} of ${upstream.jsrName}@${upstream.version}, decomposed by pkg.dog`,
    ...(upstream.packageJson.license === undefined ? {} : {license: upstream.packageJson.license}),
    homepage: 'https://pkg.dog',
    exports: exportsOut,
    ...(Object.keys(dependencies).length === 0 ? {} : {dependencies}),
    pkgdog: {
      upstream: {name: upstream.jsrName, version: upstream.version, registry: 'jsr'},
      kind: part.kind,
      subpaths: part.subpaths,
      modules: part.modules,
    },
  }
}

function describeSubpaths(part: Part): string {
  if (part.kind === 'internal') return 'Shared internals'
  return `Independent part (${part.subpaths.join(', ')})`
}

/** `@std/assert/equals` -> `@std/assert`; `foo/bar` -> `foo` */
export function externalPackageName(specifier: string): string {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : (segments[0] as string)
}
