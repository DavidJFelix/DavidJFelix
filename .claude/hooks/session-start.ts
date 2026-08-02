#!/usr/bin/env bun
import {$} from 'bun'
import {appendFileSync, existsSync, readdirSync} from 'node:fs'
import {homedir} from 'node:os'
import {join, resolve} from 'node:path'

// SessionStart hook for Claude Code on the web.
//
// A fresh web container ships with neither the mise toolchain nor any app's
// node_modules, so it cannot run a single mise task or boot an app. This hook
// bootstraps both: it installs the mise-pinned toolchain (node, bun, and the
// linters) and every app's dependencies, so checks (typecheck / lint /
// format / test / build) and smoke boots work the same way they do in CI.
//
// Local sessions only need shell activation persisted for later tool calls.
// Remote web sessions also need the toolchain and app dependencies installed.
const isRemote = process.env.CLAUDE_CODE_REMOTE === 'true'

const home = homedir()
const repo = process.env.CLAUDE_PROJECT_DIR ?? resolve(import.meta.dir, '../..')
const localBin = join(home, '.local', 'bin')
const shims = join(home, '.local', 'share', 'mise', 'shims')
const activationFile = join(repo, '.config', 'mise-agent-env.bash')
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`

// Persist mise activation for every later bash command in the session. Claude
// Code sources CLAUDE_ENV_FILE between tool calls; BASH_ENV makes each fresh
// non-interactive bash shell source the activation script on startup.
const envFile = process.env.CLAUDE_ENV_FILE
if (envFile) {
  appendFileSync(envFile, `export BASH_ENV=${shellQuote(activationFile)}\n`)
}

if (!isRemote) process.exit(0)

// 1. Install mise itself if the container doesn't already have it.
if (!existsSync(join(localBin, 'mise')) && !Bun.which('mise')) {
  await $`curl -fsSL https://mise.run | sh`
}

// Make mise and its shimmed tools resolvable for the rest of this process, and
// trust the repo config (mise refuses untrusted configs non-interactively).
process.env.PATH = `${localBin}:${shims}:${process.env.PATH}`
process.env.MISE_TRUSTED_CONFIG_PATHS = repo

// 2. Install the toolchain pinned in .config/mise.toml. The committed
//    mise.lock keeps versions deterministic and avoids GitHub release-API
//    lookups, which rate-limit on unauthenticated containers.
await $`mise trust --yes ${join(repo, '.config', 'mise.toml')}`.nothrow().quiet()
await $`mise install`.cwd(repo)

// 3. Install dependencies for every app and shared package. Lockfiles are
//    independent (this repo has no root workspace; packages/ ships to apps via
//    file: deps), so each project installs on its own. Frozen first so
//    `latest` dev deps don't drift between runs and the session sees the same
//    tree CI does; retry unfrozen to ride out lockfile drift or a transient
//    registry blip. Keep going if one install fails -- a single broken install
//    shouldn't block the session. packages/ installs first so an app's file:
//    copy picks up a ready package.
const installEnv = {...process.env, CI: 'true'}
for (const groupName of ['packages', 'apps']) {
  const groupDir = join(repo, groupName)
  if (!existsSync(groupDir)) continue
  for (const entry of readdirSync(groupDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue
    const projectDir = join(groupDir, entry.name)
    if (!existsSync(join(projectDir, 'package.json'))) continue
    console.log(`==> bun install: ${groupName}/${entry.name}`)
    let result = await $`bun install --frozen-lockfile`
      .cwd(projectDir)
      .env(installEnv)
      .nothrow()
      .quiet()
    if (result.exitCode !== 0) {
      result = await $`bun install`.cwd(projectDir).env(installEnv).nothrow().quiet()
    }
    if (result.exitCode !== 0) {
      console.error(`WARN: bun install failed in ${groupName}/${entry.name}`)
      console.error(result.stdout.toString())
      console.error(result.stderr.toString())
    }
  }
}

// 4. Install the Playwright chromium browser that djf.io's e2e suite and
//    f311x's visual-regression tests need. The binary is shared across apps via
//    ~/.cache/ms-playwright, so one install covers the repo. Best-effort: a
//    failure here shouldn't abort the session.
const playwrightApp = join(repo, 'apps', 'djf.io')
if (existsSync(join(playwrightApp, 'node_modules', '@playwright', 'test'))) {
  console.log('==> playwright install: chromium')
  await $`bun x playwright install --with-deps chromium`
    .cwd(playwrightApp)
    .env(installEnv)
    .nothrow()
    .quiet()
}

console.log('session-start: toolchain + app dependencies ready')
