import {expect, test, vi} from 'vitest'

import {readAppInstallations} from './github-app-installations'
import {resolveGitHubManageAccessURL} from './github-repo-access'

const TOKEN = 'ghu_token'

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const inputHref = (input: Parameters<FetchLike>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

const stubInstallations = (installations: unknown[]) =>
  vi.fn<FetchLike>(async () => Response.json({installations}))

test('asks for a full page of installations and parses each entry', async () => {
  const fetcher = stubInstallations([
    {
      id: 42,
      account: {login: 'acme'},
      html_url: 'https://github.com/organizations/acme/settings/installations/42',
      repository_selection: 'all',
      target_type: 'Organization',
    },
  ])

  const installations = await readAppInstallations({fetcher, token: TOKEN})

  const url = new URL(inputHref(fetcher.mock.calls[0]?.[0] ?? ''))
  expect(url.pathname).toBe('/user/installations')
  expect(url.searchParams.get('per_page')).toBe('100')
  expect(installations).toEqual([
    {
      id: 42,
      accountLogin: 'acme',
      repositorySelection: 'all',
      settingsURL: 'https://github.com/organizations/acme/settings/installations/42',
    },
  ])

  // The access diagnosis reads the same page, so an installation past the
  // first 30 still gets its own settings link.
  const manageURL = await resolveGitHubManageAccessURL({
    fetch: fetcher,
    login: 'acme',
    token: TOKEN,
  })
  const manageRequest = new URL(inputHref(fetcher.mock.calls[1]?.[0] ?? ''))
  expect(manageRequest.searchParams.get('per_page')).toBe('100')
  expect(manageURL).toBe(installations[0]?.settingsURL)
})

test.each([
  {
    targetType: 'Organization',
    expected: 'https://github.com/organizations/acme/settings/installations/7',
  },
  {targetType: 'User', expected: 'https://github.com/settings/installations/7'},
])('makes the $targetType settings URL when GitHub omits it', async ({expected, targetType}) => {
  const fetcher = stubInstallations([{id: 7, account: {login: 'acme'}, target_type: targetType}])

  const [installation] = await readAppInstallations({fetcher, token: TOKEN})

  expect(installation?.settingsURL).toBe(expected)
  expect(installation?.repositorySelection).toBe('selected')
})

test('drops entries with no id or no account login', async () => {
  const fetcher = stubInstallations([
    {account: {login: 'acme'}},
    {id: 7, account: {login: ''}},
    {id: 8},
    'acme',
  ])

  expect(await readAppInstallations({fetcher, token: TOKEN})).toEqual([])
})

test('reads a failed request as no installations', async () => {
  const fetcher = vi.fn<FetchLike>(async () => new Response(null, {status: 500}))

  expect(await readAppInstallations({fetcher, token: TOKEN})).toEqual([])
})
