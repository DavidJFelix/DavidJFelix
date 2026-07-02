#!/usr/bin/env bun
// Publish emitted parts to npm under the @pkgdog scope. Dry-run by default;
// set PKGDOG_PUBLISH=1 (with npm auth configured) to publish for real.
// Usage: bun bin/publish-parts.ts
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

const outDir = fileURLToPath(new URL('../out', import.meta.url))
const dryRun = Bun.env.PKGDOG_PUBLISH !== '1'

const partDirs: string[] = []
for await (const path of new Bun.Glob('*/package.json').scan({cwd: outDir})) {
  partDirs.push(join(outDir, path, '..'))
}
const sorted = partDirs.toSorted((a, b) => a.localeCompare(b, 'en'))
if (sorted.length === 0) {
  console.error(`no parts found in ${outDir} -- run bin/decompose.ts first`)
  process.exit(1)
}

console.log(`${dryRun ? 'DRY RUN: ' : ''}publishing ${String(sorted.length)} parts from ${outDir}`)
let failed = 0
for (const dir of sorted) {
  const {name, version} = (await Bun.file(join(dir, 'package.json')).json()) as {
    name: string
    version: string
  }
  const args = ['npm', 'publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]
  const child = Bun.spawn(args, {cwd: dir, stdout: 'pipe', stderr: 'pipe'})
  const stderr = await new Response(child.stderr).text()
  if ((await child.exited) === 0) {
    console.log(`  ok ${name}@${version}`)
  } else {
    failed += 1
    console.log(`  FAIL ${name}@${version}\n${stderr}`)
  }
}

if (failed > 0) {
  console.log(`\n${String(failed)} of ${String(sorted.length)} parts failed`)
  process.exit(1)
}
console.log(`\nall ${String(sorted.length)} parts ${dryRun ? 'passed dry-run' : 'published'}`)
if (dryRun) console.log('set PKGDOG_PUBLISH=1 with npm auth to publish for real')
