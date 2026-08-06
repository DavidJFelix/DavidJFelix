import {expect, test} from 'bun:test'
import {
  WEB_APP_TARGETS,
  type WebAppTarget,
  isUsableScmBase,
  parseAffectedPaths,
  planAffected,
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
  ...overrides,
})

test('selects only the apps turbo reported as affected', () => {
  const targets = [target({dir: 'djf.io'}), target({dir: 'ravrun'})]

  expect(planAffected({affectedPaths: ['apps/ravrun'], kind: 'preview', targets})).toEqual([
    {...(targets[1] as WebAppTarget), cloudflareEnv: ''},
  ])
})

test('previews an app with a dev environment as its dev worker only', () => {
  // revision.city previews must be versions of the dev worker: they share its
  // GitHub App for the proxied sign-in, and must never touch production's.
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
