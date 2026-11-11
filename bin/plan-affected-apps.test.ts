import {expect, test} from 'bun:test'
import {
  PREVIEW_CANARY_DIR,
  WEB_APP_TARGETS,
  type WebAppTarget,
  isUsableScmBase,
  parseAffectedPaths,
  planAffected,
  planPreview,
} from './plan-affected-apps'

const target = (overrides: Partial<WebAppTarget> = {}): WebAppTarget => ({
  dir: 'example.com',
  worker: 'example-com',
  smokeRoutes: '/',
  wranglerConfig: '',
  preview: 'wrangler',
  deploy: 'wrangler',
  envSuffix: 'EXAMPLE_COM',
  devEnv: '',
  d1Database: '',
  ...overrides,
})

test('selects only the apps turbo reported as affected', () => {
  const targets = [target({dir: 'djf.io'}), target({dir: 'ravrun'})]

  expect(planAffected({affectedPaths: ['apps/ravrun'], kind: 'preview', targets})).toEqual([
    {...(targets[1] as WebAppTarget), cloudflareEnv: ''},
  ])
})

test('previews an app with a dev environment as its dev worker only', () => {
  // A preview must be a version of the dev worker so it never runs against
  // production's secrets: revision.city's GitHub App for the proxied sign-in,
  // monicandavid.com's session-signing key.
  const targets = [target({devEnv: 'dev'})]

  expect(planAffected({affectedPaths: ['apps/example.com'], kind: 'preview', targets})).toEqual([
    {...(targets[0] as WebAppTarget), worker: 'example-com-dev', cloudflareEnv: 'dev'},
  ])
})

test('deploys an app with a dev environment as both workers', () => {
  // The dev worker's stable URL is the OAuth proxy for previews, so it has to
  // keep tracking main alongside the production deploy.
  const targets = [target({devEnv: 'dev'})]

  expect(planAffected({affectedPaths: ['apps/example.com'], kind: 'deploy', targets})).toEqual([
    {...(targets[0] as WebAppTarget), cloudflareEnv: ''},
    {...(targets[0] as WebAppTarget), worker: 'example-com-dev', cloudflareEnv: 'dev'},
  ])
})

test('keeps the D1 database on the production entry only', () => {
  // The deploy applies migrations for the entry's database. The dev worker
  // binds no D1, so its entry must not apply production's migrations again.
  const targets = [target({devEnv: 'dev', d1Database: 'example-com'})]

  expect(
    planAffected({affectedPaths: ['apps/example.com'], kind: 'deploy', targets}).map(
      (entry) => entry.d1Database,
    ),
  ).toEqual(['example-com', ''])
})

test('skips apps that opt out of the shared matrix for that kind', () => {
  // onvibes.org's preview is a real worker with a teardown, so it keeps its
  // own workflow while still deploying through the matrix.
  const targets = [target({dir: 'onvibes.org', preview: 'none', deploy: 'wrangler'})]

  expect(planAffected({affectedPaths: ['apps/onvibes.org'], kind: 'preview', targets})).toEqual([])
  expect(planAffected({affectedPaths: ['apps/onvibes.org'], kind: 'deploy', targets})).toEqual(
    targets.map((entry) => ({...entry, cloudflareEnv: ''})),
  )
})

test('ignores affected packages that are not deployable apps', () => {
  // A packages/theme change reaches the matrix only through the consumers
  // turbo also marks affected -- never as a target of its own.
  const targets = [target({dir: 'djf.io'})]

  expect(planAffected({affectedPaths: ['packages/theme'], kind: 'deploy', targets})).toEqual([])
})

test('returns nothing when no app is affected', () => {
  expect(planAffected({affectedPaths: [], kind: 'deploy', targets: [target()]})).toEqual([])
})

test('previews the canary on its dev worker when no app is affected', () => {
  // A change to repo-root tooling affects no app in turbo's graph, but it can
  // still break the preview path. The canary runs that path before the merge.
  const {apps, canary} = planPreview({affectedPaths: []})

  expect(canary).toBe(true)
  expect(apps.map(({dir, worker, cloudflareEnv}) => ({dir, worker, cloudflareEnv}))).toEqual([
    {dir: 'revision.city', worker: 'revision-city-dev', cloudflareEnv: 'dev'},
  ])
})

test('previews only the affected app when one is affected', () => {
  const {apps, canary} = planPreview({affectedPaths: ['apps/djf.io']})

  expect(canary).toBe(false)
  expect(apps.map((app) => app.dir)).toEqual(['djf.io'])
})

test('previews the canary when only an opted-out app is affected', () => {
  // f311x previews through its own workflow, so the shared matrix is empty.
  const {apps, canary} = planPreview({affectedPaths: ['apps/f311x']})

  expect(canary).toBe(true)
  expect(apps.map((app) => app.dir)).toEqual([PREVIEW_CANARY_DIR])
})

test('the canary is a registered app in the shared preview matrix', () => {
  // A registry change that drops the canary would empty the canary plan.
  expect(WEB_APP_TARGETS.find((app) => app.dir === PREVIEW_CANARY_DIR)?.preview).toBe('wrangler')
})

test('parses turbo ls output past its version banner', () => {
  const stdout = [
    '• turbo 2.10.8',
    JSON.stringify({
      packageManager: 'bun',
      packages: {count: 2, items: [{name: 'a', path: 'apps/djf.io'}, {name: 'b', path: 'packages/theme'}]},
    }),
  ].join('\n')

  expect(parseAffectedPaths(stdout)).toEqual(['apps/djf.io', 'packages/theme'])
})

test('treats output with no JSON payload as nothing affected', () => {
  expect(parseAffectedPaths('• turbo 2.10.8\n')).toEqual([])
})

test('rejects the all-zero base a first push carries, keeps a real sha', () => {
  expect(isUsableScmBase('0000000000000000000000000000000000000000')).toBe(false)
  expect(isUsableScmBase('')).toBe(false)
  expect(isUsableScmBase(undefined)).toBe(false)
  expect(isUsableScmBase('d2cd0c3')).toBe(true)
})

test('every registered app directory exists in the workspace', async () => {
  // Guards the registry against an app being renamed or removed without its
  // entry following -- the failure this replaces used to be a silent no-deploy.
  for (const app of WEB_APP_TARGETS) {
    const packageJson = Bun.file(
      new URL(`../workspaces/web-apps/apps/${app.dir}/package.json`, import.meta.url),
    )
    expect(await packageJson.exists()).toBe(true)
  }
})

test('registry covers every app in the workspace', async () => {
  const {readdirSync} = await import('node:fs')
  const dirs = readdirSync(new URL('../workspaces/web-apps/apps', import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  expect(dirs.toSorted()).toEqual(WEB_APP_TARGETS.map((app) => app.dir).toSorted())
})

test('registry names the D1 database of every app with migrations', async () => {
  // An app that adds `migrations_dir` without a registry entry would deploy
  // with its migrations unapplied, which is the gap this field closes.
  type WranglerToml = {
    readonly d1_databases?: readonly {
      readonly database_name: string
      readonly migrations_dir?: string
    }[]
  }
  for (const app of WEB_APP_TARGETS) {
    const file = Bun.file(
      new URL(`../workspaces/web-apps/apps/${app.dir}/wrangler.toml`, import.meta.url),
    )
    const config = (await file.exists()) ? (Bun.TOML.parse(await file.text()) as WranglerToml) : {}
    const migrated = (config.d1_databases ?? []).filter((database) => database.migrations_dir)
    expect(migrated.map((database) => database.database_name)).toEqual(
      app.d1Database ? [app.d1Database] : [],
    )
  }
})
