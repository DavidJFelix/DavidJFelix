#!/usr/bin/env bun
// Runs one mise task across every project in apps/ and packages/, in series,
// and prints a pass/fail summary -- the engine behind the root `test` / `check`
// aggregators, so the whole monorepo can be verified with a single command.
// Per-project CI still runs each project's tasks on path-filtered triggers;
// this is the local "check everything before I push" path.
//
// Sets CI=true for each sub-run so tools behave CI-faithfully in a
// non-interactive shell (no watch modes, no TTY prompts).

import {existsSync, readdirSync} from 'node:fs'

const task = process.argv[2] ?? 'test'
// packages/ first: apps' file: deps hard-link from there, so a broken package
// surfaces under its own name before it fails every consumer.
const groupDirs = ['packages', 'apps'].filter((dir) => existsSync(dir))

const projects = groupDirs.flatMap((groupDir) =>
  readdirSync(groupDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && existsSync(`${groupDir}/${entry.name}/mise.toml`))
    .map((entry) => `${groupDir}/${entry.name}`)
    .sort(),
)

const results: Array<{project: string; ok: boolean}> = []
for (const project of projects) {
  console.log(`\n=== ${project}: mise run ${task} ===`)
  const proc = Bun.spawn(['mise', 'run', task], {
    cwd: project,
    env: {...process.env, CI: 'true'},
    stdout: 'inherit',
    stderr: 'inherit',
  })
  results.push({project, ok: (await proc.exited) === 0})
}

console.log('\n=== summary ===')
for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.project}`)

const failed = results.filter((result) => !result.ok)
if (failed.length > 0) {
  console.error(
    `\n${failed.length} project(s) failed: ${failed.map((result) => result.project).join(', ')}`,
  )
  process.exit(1)
}
console.log(`\nall ${results.length} projects passed \`${task}\``)
