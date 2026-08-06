import type {APIRequestContext, PlaywrightWorkerArgs} from '@playwright/test'
import {expect, test} from '@playwright/test'

import {isPreviewHost} from './diffs/lib/preview-auth'

// GitHub's app-install flow lands the browser on the OAuth callback with
// ?setup_action=... and no state bound to this browser (that flow starts on
// github.com, not at /login). These prove the callback treats that landing as
// "installation finished" instead of answering 400 Invalid OAuth state.
//
// They need the worker booted with GitHub App credentials; without
// GITHUB_APP_CLIENT_ID / GITHUB_APP_CLIENT_SECRET the auth routes answer 503
// and the tests skip. Locally that means an apps/revision.city/.dev.vars with
// both values set (placeholders work -- nothing here exchanges a code); the
// deployed preview inherits the worker's real secrets.

const SETUP_CALLBACK_PATH =
  '/api/auth/github/callback?code=e2e-unverified&installation_id=1&setup_action=install'

// Probes with a throwaway context so its state cookie never leaks into a test.
async function isGitHubAuthConfigured(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string | undefined,
): Promise<boolean> {
  const probe = await playwright.request.newContext({baseURL})
  const response = await probe.get('/api/auth/github/login', {maxRedirects: 0})
  await probe.dispose()
  return response.status() !== 503
}

function getSetupCallbackResponse(
  request: APIRequestContext,
  cookie?: string,
): ReturnType<APIRequestContext['get']> {
  return request.get(SETUP_CALLBACK_PATH, {
    maxRedirects: 0,
    headers: cookie === undefined ? {} : {cookie},
  })
}

test('post-install callback returns a signed-in visitor to the app', async ({
  playwright,
  baseURL,
  request,
}) => {
  test.skip(
    !(await isGitHubAuthConfigured(playwright, baseURL)),
    'GitHub App credentials are not configured (auth routes answer 503)',
  )

  // The session cookie is the worker's own JSON payload; a placeholder token
  // works because this flow never calls GitHub.
  const session = encodeURIComponent(
    JSON.stringify({accessToken: 'e2e-placeholder', login: 'e2e-visitor'}),
  )
  const response = await getSetupCallbackResponse(request, `diffs-github-auth=${session}`)

  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe('/diffs')
})

test('post-install callback starts a state-bound sign-in for a signed-out visitor', async ({
  playwright,
  baseURL,
  request,
}) => {
  test.skip(
    !(await isGitHubAuthConfigured(playwright, baseURL)),
    'GitHub App credentials are not configured (auth routes answer 503)',
  )

  const response = await getSetupCallbackResponse(request)

  expect(response.status()).toBe(302)
  const location = response.headers().location
  // A per-PR preview cannot be an OAuth redirect target (GitHub registers no
  // wildcard callbacks), so its sign-in delegates to the dev worker, naming
  // this host's own callback as the code's destination. Everywhere else goes
  // straight to GitHub's authorize page.
  if (isPreviewHost(new URL(baseURL ?? 'http://localhost').hostname)) {
    expect(location).toContain('/api/auth/github/login?')
    expect(location).toContain(
      `proxyAuthTo=${encodeURIComponent(new URL('/api/auth/github/callback', baseURL).href)}`,
    )
  } else {
    expect(location).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/u)
  }
  expect(location).toContain('state=')
})
