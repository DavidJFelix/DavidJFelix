#!/usr/bin/env bun
// Emits the GitHub Actions matrix of web-apps affected by a change, so the
// preview and deploy workflows fan out over exactly the apps that changed
// instead of one hand-written workflow per app.
//
// Affectedness comes from `turbo ls --affected`, which walks the workspace
// dependency graph: touching packages/theme marks every app that depends on
// it, no path list required. The registry below adds what turbo cannot know --
// each app's worker name, smoke routes, and deploy config.
//
// Usage: bun bin/plan-affected-apps.ts <preview|deploy>
//   TURBO_SCM_BASE / TURBO_SCM_HEAD scope the comparison (set by the caller).
//   Writes `apps=<json>` to GITHUB_OUTPUT when running under Actions.

import {appendFileSync} from 'node:fs'
import {join, resolve} from 'node:path'

export type WebAppTarget = {
  // Directory under workspaces/web-apps/apps, and the tail of the package
  // path turbo reports.
  readonly dir: string
  // wrangler.toml `name`: the deploy target and the preview alias's base.
  readonly worker: string
  // Routes the preview smoke gate fetches, comma-separated.
  readonly smokeRoutes: string
  // Explicit wrangler config, for adapters that emit a resolved one (Astro's
  // Cloudflare adapter, flue). Empty means the app's own wrangler.toml.
  readonly wranglerConfig: string
  // 'wrangler' -- covered by the shared matrix; 'none' -- has its own
  // workflow because its lifecycle genuinely differs.
  readonly preview: 'wrangler' | 'none'
  readonly deploy: 'wrangler' | 'none'
  // Suffix of this app's per-app Actions variables (SENTRY_DSN_<suffix>,
  // POSTHOG_KEY_<suffix>, SENTRY_PROJECT_<suffix>), which the deploy matrix
  // resolves by name instead of hardcoding one app's vars per workflow.
  readonly envSuffix: string
}

// A base ref of all zeros is git's "no previous commit" sentinel, which push
// events carry for a new branch. Turbo cannot diff against it, so callers
// drop it and let turbo fall back to its own default.
export const isUsableScmBase = (base: string | undefined): base is string =>
  base !== undefined && base.length > 0 && !/^0+$/.test(base)

// The apps whose preview/deploy shape is uniform enough to share a matrix.
// f311x deploys through alchemy, and onvibes.org's preview is a real worker
// with a teardown, so both keep their own workflows and sit out here.
export const WEB_APP_TARGETS: readonly WebAppTarget[] = [
  {
    dir: 'alchemy-state-viewer',
    worker: 'alchemy-state-viewer',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'none',
    deploy: 'wrangler',
    envSuffix: 'ALCHEMY_STATE_VIEWER',
  },
  {
    dir: 'calendar-visualizer',
    worker: 'calendar-visualizer',
    smokeRoutes: '/',
    wranglerConfig: 'dist/server/wrangler.json',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'CALENDAR_VISUALIZER',
  },
  {
    dir: 'davidjfelix.com',
    worker: 'davidjfelix-com',
    smokeRoutes: '/',
    wranglerConfig: 'dist/server/wrangler.json',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'DAVIDJFELIX_COM',
  },
  {
    dir: 'djf.io',
    worker: 'djf-io',
    smokeRoutes: '/,/blog',
    wranglerConfig: 'dist/server/wrangler.json',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'DJF_IO',
  },
  {
    dir: 'f311x',
    worker: 'f311x',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'none',
    deploy: 'none',
    envSuffix: 'F311X',
  },
  {
    dir: 'forzamonica.com',
    worker: 'forzamonica-com',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'FORZAMONICA_COM',
  },
  {
    dir: 'monicandavid.com',
    worker: 'monicandavid-com',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'MONICANDAVID_COM',
  },
  {
    dir: 'onvibes.org',
    worker: 'onvibes-org',
    smokeRoutes: '/,/chat',
    wranglerConfig: 'dist-flue/onvibes_org/wrangler.json',
    preview: 'none',
    deploy: 'wrangler',
    envSuffix: 'ONVIBES_ORG',
  },
  {
    dir: 'pkg.dog',
    worker: 'pkg-dog',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'PKG_DOG',
  },
  {
    dir: 'ravrun',
    worker: 'ravrun',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'RAVRUN',
  },
  {
    dir: 'revision.city',
    worker: 'revision-city',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'REVISION_CITY',
  },
  {
    dir: 'startchi.com',
    worker: 'startchi-com',
    smokeRoutes: '/',
    wranglerConfig: '',
    preview: 'wrangler',
    deploy: 'wrangler',
    envSuffix: 'STARTCHI_COM',
  },
]

export type PlanAffectedParams = {
  // Package paths turbo reported as affected, e.g. ['apps/djf.io'].
  readonly affectedPaths: readonly string[]
  readonly kind: 'preview' | 'deploy'
  readonly targets?: readonly WebAppTarget[]
}

export const planAffected = ({
  affectedPaths,
  kind,
  targets = WEB_APP_TARGETS,
}: PlanAffectedParams): WebAppTarget[] => {
  const affected = new Set(affectedPaths)
  return targets.filter((target) => target[kind] !== 'none' && affected.has(`apps/${target.dir}`))
}

type TurboPackageList = {
  readonly packages?: {readonly items?: readonly {readonly path?: string}[]}
}

export const parseAffectedPaths = (stdout: string): string[] => {
  // `turbo ls` prefixes its JSON with a version banner line.
  const start = stdout.indexOf('{')
  if (start === -1) return []
  const parsed = JSON.parse(stdout.slice(start)) as TurboPackageList
  return (parsed.packages?.items ?? []).flatMap((item) => (item.path ? [item.path] : []))
}

if (import.meta.main) {
  const kind = process.argv[2]
  if (kind !== 'preview' && kind !== 'deploy') {
    console.error('::error::usage: plan-affected-apps.ts <preview|deploy>')
    process.exit(1)
  }

  const workspace = join(resolve(import.meta.dir, '..'), 'workspaces', 'web-apps')
  // Drop an unusable base rather than letting turbo fail on it: without one,
  // turbo compares against its own default and the matrix still plans.
  const {TURBO_SCM_BASE, ...rest} = process.env
  const env = isUsableScmBase(TURBO_SCM_BASE) ? process.env : rest
  const turbo = Bun.spawnSync(['turbo', 'ls', '--affected', '--output', 'json'], {
    cwd: workspace,
    env,
  })
  if (!turbo.success) {
    console.error('::error::turbo ls --affected failed')
    console.error(turbo.stderr.toString())
    process.exit(1)
  }

  const apps = planAffected({affectedPaths: parseAffectedPaths(turbo.stdout.toString()), kind})
  console.log(`affected ${kind} apps: ${apps.map((app) => app.dir).join(', ') || '(none)'}`)

  const output = process.env.GITHUB_OUTPUT
  if (output) appendFileSync(output, `apps=${JSON.stringify(apps)}\n`)
}
