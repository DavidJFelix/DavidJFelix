// cSpell:ignore unstub -- vitest's vi.unstubAllEnvs
import {expect, test, vi} from 'vitest'

import {parseGitHubDiffSource} from './github-diff-source'
import {diagnoseGitHubAccess, resolveGitHubManageAccessURL} from './github-repo-access'

const TOKEN = 'ghu_token'
const PULL_SOURCE = parseGitHubDiffSource('/acme/widgets/pull/7')

type FetchLike = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

interface GitHubStubOptions {
  installations?: unknown[]
  repoStatus?: number
  userStatus?: number
}

// Stands in for the three endpoints the diagnosis walks: the token check, the
// repository check, and the app's installation list.
const stubGitHub = ({installations = [], repoStatus = 404, userStatus = 200}: GitHubStubOptions) =>
  vi.fn<FetchLike>(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.endsWith('/user')) {
      return new Response(null, {status: userStatus})
    }
    if (url.endsWith('/user/installations')) {
      return Response.json({installations})
    }
    if (url.endsWith('/repos/acme/widgets')) {
      return new Response(null, {status: repoStatus})
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })

const installation = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  app_slug: 'revision-city',
  html_url: 'https://github.com/organizations/acme/settings/installations/42',
  account: {login: 'acme'},
  target_type: 'Organization',
  ...overrides,
})

test('leaves non-access failures alone', async () => {
  const fetchImpl = vi.fn<FetchLike>()
  const failure = await diagnoseGitHubAccess({
    fetch: fetchImpl,
    source: PULL_SOURCE,
    status: 500,
    token: TOKEN,
  })

  expect(failure).toBeUndefined()
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('asks a signed-out visitor to sign in without calling GitHub', async () => {
  const fetchImpl = vi.fn<FetchLike>()
  const failure = await diagnoseGitHubAccess({fetch: fetchImpl, source: PULL_SOURCE, status: 404})

  expect(failure?.remedy).toEqual({kind: 'sign-in'})
  expect(failure?.message).toContain('acme/widgets')
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('stays quiet for a signed-out visitor on a non-GitHub source', async () => {
  const failure = await diagnoseGitHubAccess({fetch: vi.fn<FetchLike>(), status: 404})

  expect(failure).toBeUndefined()
})

test('offers a fresh sign-in when GitHub rejects the token', async () => {
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({userStatus: 401}),
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })

  expect(failure?.remedy).toEqual({kind: 'sign-in-again'})
})

test('points at the existing installation when the app is installed but the repo is not granted', async () => {
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({installations: [installation()]}),
    login: 'reviewer',
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })

  expect(failure?.remedy).toEqual({
    kind: 'grant-repo-access',
    url: 'https://github.com/organizations/acme/settings/installations/42',
  })
  expect(failure?.message).toContain('installed on acme')
  expect(failure?.message).toContain('asks an owner of acme to approve')
})

test('reconstructs the installation settings URL when GitHub omits it', async () => {
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({
      installations: [
        installation({html_url: undefined, target_type: 'User', account: {login: 'Acme'}}),
      ],
    }),
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })

  expect(failure?.remedy).toEqual({
    kind: 'grant-repo-access',
    url: 'https://github.com/settings/installations/42',
  })
})

test('offers the install page when the owner has no installation, using a slug from another one', async () => {
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({installations: [installation({account: {login: 'other-org'}})]}),
    login: 'acme',
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })

  expect(failure?.remedy).toEqual({
    kind: 'grant-repo-access',
    url: 'https://github.com/apps/revision-city/installations/new',
  })
  expect(failure?.message).toContain('not installed on acme')
  // The visitor owns the account, so there is nobody else to ask.
  expect(failure?.message).not.toContain('approve')
})

test('falls back to the configured app slug when the visitor has no installations', async () => {
  vi.stubEnv('GITHUB_APP_SLUG', 'revision-city')
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({}),
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })
  vi.unstubAllEnvs()

  expect(failure?.remedy).toEqual({
    kind: 'grant-repo-access',
    url: 'https://github.com/apps/revision-city/installations/new',
  })
})

test('explains the failure without an action when no app slug is known', async () => {
  vi.stubEnv('GITHUB_APP_SLUG', '')
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({}),
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })
  vi.unstubAllEnvs()

  expect(failure?.remedy).toBeUndefined()
  expect(failure?.message).toContain('not installed on acme')
})

test('separates a readable repository from an unreadable pull request', async () => {
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({repoStatus: 200}),
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })

  expect(failure?.remedy).toBeUndefined()
  expect(failure?.message).toContain('pull request #7')
})

test('manages access at the installation itself when there is exactly one', async () => {
  const url = await resolveGitHubManageAccessURL({
    fetch: stubGitHub({installations: [installation()]}),
    token: TOKEN,
  })

  expect(url).toBe('https://github.com/organizations/acme/settings/installations/42')
})

test('lets GitHub ask which account when there are several installations', async () => {
  const url = await resolveGitHubManageAccessURL({
    fetch: stubGitHub({
      installations: [installation(), installation({id: 43, account: {login: 'other-org'}})],
    }),
    token: TOKEN,
  })

  expect(url).toBe('https://github.com/apps/revision-city/installations/new')
})

test('sends a visitor with no installation to the install page', async () => {
  vi.stubEnv('GITHUB_APP_SLUG', 'revision-city')
  const url = await resolveGitHubManageAccessURL({fetch: stubGitHub({}), token: TOKEN})
  vi.unstubAllEnvs()

  expect(url).toBe('https://github.com/apps/revision-city/installations/new')
})

test('falls back to the installed-apps list when no app slug is known', async () => {
  vi.stubEnv('GITHUB_APP_SLUG', '')
  const url = await resolveGitHubManageAccessURL({fetch: stubGitHub({}), token: TOKEN})
  vi.unstubAllEnvs()

  expect(url).toBe('https://github.com/settings/installations')
})

test('reports an SSO or rate-limit block on the repository as its own case', async () => {
  const failure = await diagnoseGitHubAccess({
    fetch: stubGitHub({repoStatus: 403}),
    source: PULL_SOURCE,
    status: 404,
    token: TOKEN,
  })

  expect(failure?.remedy).toBeUndefined()
  expect(failure?.message).toContain('blocked access to acme/widgets')
})
