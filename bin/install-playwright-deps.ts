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
// run's downloads become the next run's warm hit. apt runs as root for that
// download, so the cold path ends by handing the directory back to the user
// the cache step's tar runs as.
//
// Usage: bun bin/install-playwright-deps.ts
// Run from the app directory (`bun x` resolves the app's playwright).
// PW_DEPS_CACHE_DIR overrides the default ~/.cache/playwright-apt; it must
// match the path the workflow's cache step saves.

// cSpell:ignore nothrow -- Bun shell API ($`...`.nothrow())

import {$} from 'bun'
import {mkdir, readdir, rm} from 'node:fs/promises'
import {homedir, userInfo} from 'node:os'
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
// downloaded packages, so the workflow's cache step can save them. Only the
// directory itself is created here: apt makes its own `partial/` inside it
// and takes it over (owner _apt, mode 0700), so pre-creating one just hands
// apt something to take back.
await mkdir(cacheDir, {recursive: true})
const aptConf = `Dir::Cache::Archives "${cacheDir}";\nAPT::Keep-Downloaded-Packages "true";\n`
await $`echo ${aptConf} | sudo tee /etc/apt/apt.conf.d/99playwright-deps-cache`.quiet()
await $`bun x playwright install-deps chromium`

// apt ran as root (install-deps wraps it in sudo) and left the directory
// unreadable to anyone else: a root-owned `lock` (mode 0640), the `_apt`-owned
// `partial/` (mode 0700), and root-owned .deb files. The workflow's cache save
// runs tar as the runner user, which cannot open the first two, so tar exits 2
// and the save is abandoned along with every archive this run just
// downloaded. Hand the tree back and drop both apt-owned entries -- neither is
// cache content, and apt recreates them on the next cold run.
const {uid, gid} = userInfo()
const owner = `${uid}:${gid}`
await $`sudo chown -R ${owner} ${cacheDir}`
await rm(join(cacheDir, 'lock'), {force: true})
await rm(join(cacheDir, 'partial'), {recursive: true, force: true})
