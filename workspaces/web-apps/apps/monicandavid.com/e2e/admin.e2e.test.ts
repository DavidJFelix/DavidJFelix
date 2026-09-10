import {expect, test} from '@playwright/test'
import {SESSION_COOKIE, signSession} from '../src/lib/server/session'

// /admin is gated by the session cookie (src/hooks.server.ts). The unsigned
// cases prove the gate is closed on any deployment. The signed cases mint
// tokens with the worker's own secret, so they run only where that secret is
// known: the local production boot (playwright.config.ts passes it to wrangler
// and exposes it as E2E_SESSION_SECRET) or a preview given the same variable.

const secret = process.env.E2E_SESSION_SECRET
const userId = 'user_01K4R3ZJ3M9EFB7GX0Q2T5V8WA' // cSpell:ignore 01K4R3ZJ3M9EFB7GX0Q2T5V8WA

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000)
}

// A token the server would issue: dated a minute ago, good for an hour.
function mint(overrides: {secret?: string; issuedAt?: Date; expiresAt?: Date} = {}) {
  return signSession({
    userId,
    secret: overrides.secret ?? secret ?? '',
    issuedAt: overrides.issuedAt ?? minutesFromNow(-1),
    expiresAt: overrides.expiresAt ?? minutesFromNow(60),
  })
}

test('the admin page turns away a visitor with no session', async ({page}) => {
  // when
  const response = await page.goto('/admin')

  // then
  expect(response?.status()).toBe(401)
  await expect(page.getByText('Sign in to continue')).toBeVisible()
})

test('the admin page data request turns away a visitor with no session', async ({request}) => {
  // when: the fetch client-side navigation would make
  const response = await request.get('/admin/__data.json')

  // then
  expect(response.status()).toBe(401)
})

test('a session cookie that is not a token is refused', async ({request}) => {
  // when
  const response = await request.get('/admin', {
    headers: {cookie: `${SESSION_COOKIE}=not-a-token`},
  })

  // then
  expect(response.status()).toBe(401)
})

test('a session signed with the shared secret opens the admin page', async ({page, context}) => {
  test.skip(secret === undefined, 'needs E2E_SESSION_SECRET to mint a token the worker trusts')
  // given
  await page.goto('/')
  await context.addCookies([{name: SESSION_COOKIE, value: await mint(), url: page.url()}])

  // when
  const response = await page.goto('/admin')

  // then
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('Admin')
})

// Playwright's case table: one test per row, the same as a vitest test.each.
const refusedTokens = [
  ['signed with a different secret', () => mint({secret: 'not-the-shared-secret-at-all-no-sir'})],
  ['already expired', () => mint({expiresAt: minutesFromNow(-1)})],
  ['not issued yet', () => mint({issuedAt: minutesFromNow(5)})],
] as const

for (const [flaw, mintToken] of refusedTokens) {
  test(`a session token ${flaw} is refused`, async ({request}) => {
    test.skip(secret === undefined, 'needs E2E_SESSION_SECRET to mint a token the worker trusts')
    // given
    const token = await mintToken()

    // when
    const response = await request.get('/admin', {headers: {cookie: `${SESSION_COOKIE}=${token}`}})

    // then
    expect(response.status()).toBe(401)
  })
}
