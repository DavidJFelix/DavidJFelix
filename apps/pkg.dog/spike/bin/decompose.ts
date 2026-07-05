#!/usr/bin/env bun
// Feasibility spike entry point: fetch a JSR package, decompose it into
// independent parts, emit them as installable packages for the pkg.dog
// registry, and verify each part against upstream. Follow with
// bin/verify-registry.ts. Usage: bun bin/decompose.ts [jsrName] [version]
import {rm} from 'node:fs/promises'
import {join, normalize} from 'node:path'
import {fileURLToPath} from 'node:url'
import {behaviorCheckScript} from '../src/behavior-check.ts'
import {type EntryPaths, planDecomposition, sanitizeBase} from '../src/decompose.ts'
import {emitParts} from '../src/emit.ts'
import {buildModuleGraph, type SourceFile} from '../src/module-graph.ts'
import {fetchUpstream} from '../src/registry.ts'
import {verifyParts} from '../src/verify.ts'

const jsrName = Bun.argv[2] ?? '@std/collections'
const version = Bun.argv[3]
const spikeRoot = fileURLToPath(new URL('..', import.meta.url))
const workDir = join(spikeRoot, 'work', sanitizeBase(jsrName))
const outDir = join(spikeRoot, 'out')
const verifyDir = join(spikeRoot, 'work', 'verify-consumer')

console.log(`fetching ${jsrName}${version === undefined ? '' : `@${version}`} from JSR...`)
const upstream = await fetchUpstream(jsrName, workDir, version)
console.log(`extracted ${upstream.jsrName}@${upstream.version} -> ${upstream.dir}`)

const files: SourceFile[] = []
for (const pattern of ['**/*.js', '**/*.d.ts']) {
  for await (const path of new Bun.Glob(pattern).scan({cwd: upstream.dir})) {
    files.push({path: normalize(path), text: await Bun.file(join(upstream.dir, path)).text()})
  }
}

const exportsMap = new Map<string, EntryPaths>()
const runtimeToTypes = new Map<string, string>()
const filePaths = new Set(files.map((f) => f.path))
for (const [subpath, value] of Object.entries(upstream.packageJson.exports)) {
  const runtime = normalize(typeof value === 'string' ? value : value.default)
  if (!runtime.endsWith('.js')) continue
  const types = typeof value === 'string' ? undefined : value.types
  const normalizedTypes = types === undefined ? undefined : normalize(types)
  exportsMap.set(subpath, {runtime, types: normalizedTypes})
  if (normalizedTypes !== undefined) runtimeToTypes.set(runtime, normalizedTypes)
}
for (const path of filePaths) {
  if (!path.endsWith('.js') || runtimeToTypes.has(path)) continue
  const mirror = normalize(join('_dist', path.replace(/\.js$/u, '.d.ts')))
  const sibling = path.replace(/\.js$/u, '.d.ts')
  if (filePaths.has(mirror)) runtimeToTypes.set(path, mirror)
  else if (filePaths.has(sibling)) runtimeToTypes.set(path, sibling)
}

const graph = buildModuleGraph(files, runtimeToTypes)
const plan = planDecomposition({
  graph,
  exports: exportsMap,
  upstream: {jsrName: upstream.jsrName, version: upstream.version},
})

await rm(outDir, {recursive: true, force: true})
const emitted = await emitParts(plan, upstream, outDir)
await Bun.write(join(outDir, 'decompose-plan.json'), `${JSON.stringify(plan, null, 2)}\n`)

const exportParts = plan.parts.filter((p) => p.kind === 'export')
const internalParts = plan.parts.filter((p) => p.kind === 'internal')
const withDeps = plan.parts.filter((p) => p.partDeps.length > 0)
console.log(
  `\nplanned ${String(plan.parts.length)} parts from ${String(graph.modules.size)} modules:`,
)
console.log(
  `  ${String(exportParts.length)} export parts, ${String(internalParts.length)} shared-internal parts`,
)
for (const {subpath, reason} of plan.skipped) console.log(`  skipped ${subpath}: ${reason}`)
for (const part of withDeps) {
  console.log(`  ${part.name} -> depends on ${part.partDeps.join(', ')}`)
}

console.log('\nverifying parts against upstream...')
const failures = await verifyParts(emitted, upstream, verifyDir)
for (const {specifier, reason} of failures) console.log(`  FAIL ${specifier}: ${reason}`)

let behaviorOk = true
if (upstream.jsrName === '@std/collections' && failures.length === 0) {
  const checkPath = join(verifyDir, 'behavior-check.ts')
  await Bun.write(checkPath, behaviorCheckScript('@pkgdog'))
  const child = Bun.spawn(['bun', 'behavior-check.ts'], {
    cwd: verifyDir,
    stdout: 'inherit',
    timeout: 120_000,
  })
  behaviorOk = (await child.exited) === 0
}

if (failures.length > 0 || !behaviorOk) {
  console.log('\nverification FAILED')
  process.exit(1)
}
console.log(`\nverification passed: ${String(emitted.length)} parts installable and equivalent`)
console.log(`parts emitted to ${outDir}`)
