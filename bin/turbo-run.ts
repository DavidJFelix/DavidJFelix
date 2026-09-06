#!/usr/bin/env bun
// Wraps `turbo run` for the web-apps workspace. Turbo cannot hash files above
// its workspace root (workspaces/web-apps), so the repo-root configs that
// still shape task results feed in through the REPO_CONFIG_HASH global env
// var declared in turbo.json's globalEnv -- a change to any of them busts
// every task's cache.
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'

const repo = resolve(import.meta.dir, '..')
const workspace = join(repo, 'workspaces', 'web-apps')
// package.json + bun.lock: the linters and formatters every app's scripts run
// (biome, oxlint, oxfmt, prettier) are pinned at the repo root, not in the
// workspace lockfile turbo hashes on its own.
const hashedFiles = [
  '.config/mise.toml',
  '.config/mise.lock',
  'package.json',
  'bun.lock',
  '.oxfmtrc.json',
  '.prettierrc.json',
]

const hash = createHash('sha256')
for (const file of hashedFiles) {
  hash.update(file)
  hash.update(readFileSync(join(repo, file)))
}

// The workspace's own turbo (a devDependency there), by path rather than
// PATH lookup, so the version the lockfile pins is the one that runs.
const proc = Bun.spawnSync([join(workspace, 'node_modules', '.bin', 'turbo'), 'run', ...process.argv.slice(2)], {
  cwd: workspace,
  stdio: ['inherit', 'inherit', 'inherit'],
  env: {...process.env, REPO_CONFIG_HASH: hash.digest('hex')},
})
process.exit(proc.exitCode ?? 1)
