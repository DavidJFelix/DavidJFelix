import {expect, test} from 'bun:test'
import {
  type PlanAffectedParams,
  WEB_APP_TARGETS,
  type WebAppTarget,
  isUsableScmBase,
  parseAffectedPaths,
  planAffected,
  planAffectedOrAll,
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
  productionUrl: '',
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

test('keeps the production URL on the production deploy entry only', () => {
  // The deploy smokes the entry's production URL. The dev worker and the
  // previews do not serve the custom domain, so their entries must skip it.
  const withDev = [target({devEnv: 'dev', productionUrl: 'https://example.com'})]
  const productionOnly = [target({productionUrl: 'https://example.com'})]
  const urls = (params: Omit<PlanAffectedParams, 'affectedPaths'>) =>
    planAffected({affectedPaths: ['apps/example.com'], ...params}).map(
      (entry) => entry.productionUrl,
    )

  expect(urls({kind: 'deploy', targets: withDev})).toEqual(['https://example.com', ''])
  expect(urls({kind: 'deploy', targets: productionOnly})).toEqual(['https://example.com'])
  expect(urls({kind: 'preview', targets: withDev})).toEqual([''])
  expect(urls({kind: 'preview', targets: productionOnly})).toEqual([''])
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

test('plans every matrix app when no app is affected', () => {
  // A change to repo-root tooling affects no app in turbo's graph, but it can
  // change every build, so every app previews and deploys with it.
  const targets = [
    target({dir: 'djf.io'}),
    target({dir: 'onvibes.org', preview: 'none'}),
    target({dir: 'ravrun'}),
  ]

  const preview = planAffectedOrAll({affectedPaths: [], kind: 'preview', targets})
  expect(preview.all).toBe(true)
  expect(preview.apps.map((app) => app.dir)).toEqual(['djf.io', 'ravrun'])

  const deploy = planAffectedOrAll({affectedPaths: [], kind: 'deploy', targets})
  expect(deploy.all).toBe(true)
  expect(deploy.apps.map((app) => app.dir)).toEqual(['djf.io', 'onvibes.org', 'ravrun'])
})

test('plans only the affected app when one is affected', () => {
  const targets = [target({dir: 'djf.io'}), target({dir: 'ravrun'})]

  const {apps, all} = planAffectedOrAll({affectedPaths: ['apps/djf.io'], kind: 'preview', targets})
  expect(all).toBe(false)
  expect(apps.map((app) => app.dir)).toEqual(['djf.io'])
})

test('plans nothing when only an app outside the matrix is affected', () => {
  // f311x previews and deploys through its own workflow. A change to it is not
  // a tooling change, so it must not preview or deploy every other app.
  const targets = [target({dir: 'f311x', preview: 'none', deploy: 'none'}), target({dir: 'ravrun'})]

  for (const kind of ['preview', 'deploy'] as const) {
    expect(planAffectedOrAll({affectedPaths: ['apps/f311x'], kind, targets})).toEqual({
      apps: [],
      all: false,
    })
  }
})

test('plans every matrix app when only a shared package is affected', () => {
  // A package that no app depends on reaches no app in turbo's graph, the same
  // as a repo-root tooling change.
  const targets = [target({dir: 'ravrun'})]

  const {apps, all} = planAffectedOrAll({affectedPaths: ['packages/theme'], kind: 'deploy', targets})
  expect(all).toBe(true)
  expect(apps.map((app) => app.dir)).toEqual(['ravrun'])
})

test('every app keeps its dev worker shape when every app is planned', () => {
  // The registry's dev-environment apps still preview as their dev worker
  // only, and still deploy as both workers.
  const preview = planAffectedOrAll({affectedPaths: [], kind: 'preview'})
  expect(preview.apps.map((app) => app.worker)).toContain('revision-city-dev')
  expect(preview.apps.map((app) => app.worker)).not.toContain('revision-city')

  const deploy = planAffectedOrAll({affectedPaths: [], kind: 'deploy'})
  expect(deploy.apps.map((app) => app.worker)).toEqual(
    expect.arrayContaining(['revision-city', 'revision-city-dev']),
  )
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

test('registry names the production URL of every app with a custom domain', async () => {
  // The deploy smokes this URL. It must be the first custom domain in the
  // app's wrangler.toml, so a domain added or removed there is not forgotten.
  type WranglerToml = {
    readonly routes?: readonly {readonly pattern: string; readonly custom_domain?: boolean}[]
  }
  for (const app of WEB_APP_TARGETS) {
    const file = Bun.file(
      new URL(`../workspaces/web-apps/apps/${app.dir}/wrangler.toml`, import.meta.url),
    )
    const config = (await file.exists()) ? (Bun.TOML.parse(await file.text()) as WranglerToml) : {}
    const domain = (config.routes ?? []).find((route) => route.custom_domain)?.pattern
    expect({dir: app.dir, productionUrl: app.productionUrl}).toEqual({
      dir: app.dir,
      productionUrl: domain ? `https://${domain}` : '',
    })
  }
})
