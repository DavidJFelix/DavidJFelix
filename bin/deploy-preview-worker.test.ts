import {expect, test} from 'bun:test'
import {buildPreviewConfig, parseDeployedUrl, previewWorkerName} from './deploy-preview-worker'

test('names the preview worker <worker>-pr-<N>', () => {
  expect(previewWorkerName('onvibes-org', '303')).toBe('onvibes-org-pr-303')
})

test('rewrites the built config: renamed, routes stripped, workers.dev on', () => {
  const built = {
    name: 'onvibes-org',
    main: 'index.js',
    routes: [{pattern: 'onvibes.org', custom_domain: true}],
    durable_objects: {bindings: [{name: 'FLUE_REGISTRY', class_name: 'FlueRegistry'}]},
    migrations: [{tag: 'v1', new_sqlite_classes: ['FlueRegistry']}],
    assets: {directory: '../../dist/client', binding: 'ASSETS'},
  }
  const preview = buildPreviewConfig(built, {prNumber: '303', workerName: 'onvibes-org'})

  expect(preview.name).toBe('onvibes-org-pr-303')
  expect(preview.routes).toBeUndefined()
  expect(preview.workers_dev).toBe(true)
  // Durable Objects, migrations, and assets deploy unchanged: a fresh worker
  // takes the migration via real `wrangler deploy`, isolated from production.
  expect(preview.durable_objects).toEqual(built.durable_objects)
  expect(preview.migrations).toEqual(built.migrations)
  expect(preview.assets).toEqual(built.assets)
  // The source object is not mutated (the caller may reuse it).
  expect(built.name).toBe('onvibes-org')
  expect(built.routes).toHaveLength(1)
})

test('parses the deployed workers.dev URL out of wrangler output', () => {
  const stdout = [
    'Total Upload: 9199.61 KiB / gzip: 1677.39 KiB',
    'Deployed onvibes-org-pr-303 triggers (2.34 sec)',
    '  https://onvibes-org-pr-303.felixdj.workers.dev',
    'Current Version ID: 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  ].join('\n')
  expect(parseDeployedUrl(stdout)).toBe('https://onvibes-org-pr-303.felixdj.workers.dev/')
})

test('throws when wrangler printed no workers.dev URL', () => {
  expect(() => parseDeployedUrl('Deployed. No routes.\n')).toThrow(/workers\.dev/)
})
