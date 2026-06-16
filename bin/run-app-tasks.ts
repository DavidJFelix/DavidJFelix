#!/usr/bin/env bun
// Runs one mise task across every app in apps/, in series, and prints a pass/
// fail summary -- the engine behind the root `test` / `check` aggregators, so the
// whole monorepo can be verified with a single command. Per-app CI still runs
// each app's tasks on path-filtered triggers; this is the local "check
// everything before I push" path.
//
// Sets CI=true for each sub-run so pnpm's verify-deps-before-run won't abort on a
// drifted node_modules in a non-interactive shell
// (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).

import {existsSync, readdirSync} from 'node:fs'

const task = process.argv[2] ?? 'test'
const appsDir = 'apps'

const apps = readdirSync(appsDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory() && existsSync(`${appsDir}/${entry.name}/mise.toml`))
  .map((entry) => entry.name)
  .sort()

const results: Array<{app: string; ok: boolean}> = []
for (const app of apps) {
  console.log(`\n=== ${app}: mise run ${task} ===`)
  const proc = Bun.spawn(['mise', 'run', task], {
    cwd: `${appsDir}/${app}`,
    env: {...process.env, CI: 'true'},
    stdout: 'inherit',
    stderr: 'inherit',
  })
  results.push({app, ok: (await proc.exited) === 0})
}

console.log('\n=== summary ===')
for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.app}`)

const failed = results.filter((result) => !result.ok)
if (failed.length > 0) {
  console.error(
    `\n${failed.length} app(s) failed: ${failed.map((result) => result.app).join(', ')}`,
  )
  process.exit(1)
}
console.log(`\nall ${results.length} apps passed \`${task}\``)
