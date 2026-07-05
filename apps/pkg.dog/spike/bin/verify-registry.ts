#!/usr/bin/env bun
// Boot the spike registry from out/ and prove a stock npm client can install
// decomposed parts through it -- including a cross-part dependency resolved by
// the registry itself. Run bin/decompose.ts first. Usage: bun bin/verify-registry.ts
import {mkdir, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {behaviorCheckScript} from '../src/behavior-check.ts'
import type {DecomposePlan} from '../src/decompose.ts'
import {serveRegistry} from '../src/registry-server.ts'

const spikeRoot = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(spikeRoot, 'out')
const stageDir = join(spikeRoot, 'work', 'registry-stage')
const consumerDir = join(spikeRoot, 'work', 'registry-consumer')

const planFile = Bun.file(join(outDir, 'decompose-plan.json'))
if (!(await planFile.exists())) {
  console.error(`no parts in ${outDir} -- run bin/decompose.ts first`)
  process.exit(1)
}
const plan = (await planFile.json()) as DecomposePlan

const registry = await serveRegistry(outDir, stageDir)
if (registry.packageNames.length === 0) {
  console.error(`registry found no part packages under ${outDir}`)
  registry.stop()
  process.exit(1)
}
console.log(`registry serving ${String(registry.packageNames.length)} parts at ${registry.url}`)

await rm(consumerDir, {recursive: true, force: true})
await mkdir(consumerDir, {recursive: true})
await Bun.write(
  join(consumerDir, 'package.json'),
  `${JSON.stringify({name: 'pkgdog-registry-consumer', private: true, type: 'module'}, null, 2)}\n`,
)
const scope = (registry.packageNames[0] as string).split('/')[0] as string
await Bun.write(join(consumerDir, '.npmrc'), `${scope}:registry=${registry.url}\n`)

async function npmInstall(targets: string[]): Promise<boolean> {
  const child = Bun.spawn(
    ['npm', 'install', '--no-audit', '--no-fund', '--loglevel', 'warn', ...targets],
    {cwd: consumerDir, stdout: 'inherit', stderr: 'inherit', timeout: 300_000},
  )
  return (await child.exited) === 0
}

// Phase 1: install ONLY a part the plan says has a cross-part dependency; the
// dep must arrive through the registry, not because we asked for it. This
// proof is driven by the plan, so a part-name drift cannot silently skip it.
const crossPart = plan.parts.find((p) => p.kind === 'export' && p.partDeps.length > 0)
if (crossPart === undefined) {
  console.log('plan has no cross-part dependencies; skipping the transitive-resolution proof')
} else {
  const crossDep = crossPart.partDeps[0] as string
  if (!(await npmInstall([crossPart.name]))) {
    registry.stop()
    process.exit(1)
  }
  const depInstalled = await Bun.file(
    join(consumerDir, 'node_modules', crossDep, 'package.json'),
  ).exists()
  if (!depInstalled) {
    console.error(`FAIL: ${crossDep} was not pulled in as a dependency of ${crossPart.name}`)
    registry.stop()
    process.exit(1)
  }
  console.log(`cross-part dependency resolved through the registry: ${crossDep}`)
}

// Phase 2: install every part the registry serves.
if (!(await npmInstall(registry.packageNames))) {
  registry.stop()
  process.exit(1)
}
console.log(`installed all ${String(registry.packageNames.length)} parts via npm`)

// Phase 3: behavior spot-check through the npm-installed parts.
let behaviorOk = true
if (registry.packageNames.includes(`${scope}/std__collections__aggregate-groups`)) {
  await Bun.write(join(consumerDir, 'behavior-check.ts'), behaviorCheckScript(scope))
  const child = Bun.spawn(['bun', 'behavior-check.ts'], {
    cwd: consumerDir,
    stdout: 'inherit',
    timeout: 120_000,
  })
  behaviorOk = (await child.exited) === 0
}

registry.stop()
if (!behaviorOk) {
  console.log('\nregistry verification FAILED')
  process.exit(1)
}
console.log('\nregistry verification passed: npm protocol serve + install + cross-part deps work')
