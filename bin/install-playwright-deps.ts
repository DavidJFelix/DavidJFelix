#!/usr/bin/env bun
// Installs the system packages Playwright's Chromium needs without paying the
// apt mirrors on every CI run. `playwright install-deps` spends minutes in
// `apt-get update` plus package downloads on a fresh runner, but the .deb
// archives it fetches are stable for a given Playwright version -- so the
// calling workflow caches them (keyed on that version) and this script
// installs straight from the cache: `dpkg -i` on the archived debs takes
// seconds and needs no network. A cold cache (or stale debs after the runner
// image drifts) falls back to the real `playwright install-deps`, with apt
// configured to download into -- and keep -- the cache directory, so this
// run's downloads become the next run's warm hit.
//
// Usage: bun bin/install-playwright-deps.ts
// Run from the app directory (`bun x` resolves the app's playwright).
// PW_DEPS_CACHE_DIR overrides the default ~/.cache/playwright-apt; it must
// match the path the workflow's cache step saves.

// cSpell:ignore nothrow -- Bun shell API ($`...`.nothrow())

import {$} from 'bun'
import {mkdir, readdir} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

const cacheDir = process.env.PW_DEPS_CACHE_DIR ?? join(homedir(), '.cache', 'playwright-apt')

const debs = (await readdir(cacheDir).catch(() => []))
  .filter((name) => name.endsWith('.deb'))
  .map((name) => join(cacheDir, name))

if (debs.length > 0) {
  console.log(`installing ${debs.length} cached .deb archive(s) from ${cacheDir}`)
  const dpkg = await $`sudo dpkg -i ${debs}`.nothrow()
  if (dpkg.exitCode === 0) process.exit(0)
  // Stale archives -- the runner image moved under them. Repair any
  // half-configured packages, then repopulate through the cold path.
  console.warn(`::warning::dpkg exited ${dpkg.exitCode}; falling back to playwright install-deps`)
  await $`sudo dpkg --configure -a`.nothrow()
}

// Cold path: aim apt's archive cache at the cached directory and keep the
// downloaded packages, so the workflow's cache step can save them.
await mkdir(join(cacheDir, 'partial'), {recursive: true})
const aptConf = `Dir::Cache::Archives "${cacheDir}";\nAPT::Keep-Downloaded-Packages "true";\n`
await $`echo ${aptConf} | sudo tee /etc/apt/apt.conf.d/99playwright-deps-cache`.quiet()
await $`bun x playwright install-deps chromium`
