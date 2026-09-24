import {pngSize} from '@davidjfelix/og/png'
import {expect, test} from '@playwright/test'

// What a shared /diffs link unfurls as: the head the worker renders for a diff
// path, and the card that head points at. Both are proven against a repository
// that cannot exist (GitHub allows no consecutive hyphens in a name), so every
// run takes the same path -- GitHub has nothing public to say and the text
// falls back to what the URL says -- with no dependence on live content.

// A preview build bakes its pr-<N> URL into the absolute tags (see
// .depot/actions/preview-wrangler); a local boot carries the canonical origin.
const origin = process.env.PREVIEW_URL
  ? new URL(process.env.PREVIEW_URL).origin
  : 'https://revision.city'

const REPO = 'no--such--org/no--such--repo'
const PULL_PATH = `/diffs/${REPO}/pull/1`

test('a pull request link unfurls with its repository, number, and own card', async ({page}) => {
  await page.goto(PULL_PATH)
  const head = page.locator('head')
  await expect(page).toHaveTitle(`${REPO} #1 · revision.city`)
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute('content', `${REPO} #1`)
  await expect(head.locator('meta[name="twitter:title"]')).toHaveAttribute('content', `${REPO} #1`)
  await expect(head.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    `Pull request #1 in ${REPO}, in the revision.city diff viewer.`,
  )
  await expect(head.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${origin}${PULL_PATH}`,
  )
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${origin}${PULL_PATH}`,
  )
  await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${origin}/og/diffs/${REPO}/pull/1.png`,
  )
  await expect(head.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    `Title card for ${REPO} #1`,
  )
  // The site-level tags still come through the root route underneath.
  await expect(head.locator('meta[property="og:site_name"]')).toHaveAttribute(
    'content',
    'revision.city',
  )
})

test('a commit link unfurls with its short SHA', async ({page}) => {
  await page.goto(`/diffs/${REPO}/commit/83fea5e63ef8751ddbcfabe33154bc2e096c3d85`)
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute(
    'content',
    `${REPO} @ 83fea5e`,
  )
})

// A ref may carry a percent sign, which the router hands over decoded and the
// parser must not decode again: such a link renders instead of failing the route.
test('a compare range with a stray percent sign still unfurls', async ({page}) => {
  const response = await page.goto(`/diffs/${REPO}/compare/foo%25...bar`)
  expect(response?.status()).toBe(200)
  const head = page.locator('head')
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    `${REPO} foo%...bar`,
  )
  await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${origin}/og/diffs/${REPO}/compare/foo%25...bar.png`,
  )
})

// A path under an alternate domain is another diff, so the domain rides on
// og:url and the canonical link; the text and card stay the generic ones, since
// only GitHub paths have a shape the viewer can name.
test('an alternate-domain link keeps its domain in og:url and shares the generic card', async ({
  page,
}) => {
  await page.goto(`${PULL_PATH}?domain=tangled.org`)
  const head = page.locator('head')
  await expect(head.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${origin}${PULL_PATH}?domain=tangled.org`,
  )
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${origin}${PULL_PATH}?domain=tangled.org`,
  )
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Diffs · revision.city',
  )
  await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${origin}/og/default.png`,
  )
})

// The router hands every match the raw search along with what its route
// validates, so the root keeps only the params that make a path another page:
// a tracker's tag on a shared link stays off og:url and the canonical link.
test('a tracker tag on the link stays off og:url and the canonical link', async ({page}) => {
  await page.goto(`${PULL_PATH}?utm_source=newsletter&domain=tangled.org`)
  const head = page.locator('head')
  await expect(head.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    `${origin}${PULL_PATH}?domain=tangled.org`,
  )
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${origin}${PULL_PATH}?domain=tangled.org`,
  )
  await page.goto('/?utm_source=newsletter')
  await expect(head.locator('meta[property="og:url"]')).toHaveAttribute('content', `${origin}/`)
  await expect(head.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/`)
})

// The card renders on the worker at request time; fetch it from this boot. A
// pull request card drawn without GitHub's answer lives only as long as the
// lookup remembers a miss; a compare card has nothing to wait for and keeps
// the hour.
;[
  {path: `/og/diffs/${REPO}/pull/1.png`, cacheControl: 'public, max-age=300'},
  {path: `/og/diffs/${REPO}/compare/v1.0...v2.0.png`, cacheControl: 'public, max-age=3600'},
].forEach(({path, cacheControl}) => {
  test(`${path} serves a diff card at the shared size`, async ({request}) => {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('image/png')
    expect(response.headers()['cache-control']).toBe(cacheControl)
    const png = await response.body()
    expect(pngSize(png)).toEqual({width: 1200, height: 630})
    // Scrapers and CDNs probe the image with HEAD before fetching it: GET's
    // status and headers, no body.
    const probe = await request.head(path)
    expect(probe.status()).toBe(200)
    expect(probe.headers()['content-type']).toContain('image/png')
    expect(probe.headers()['cache-control']).toBe(cacheControl)
    expect(probe.headers()['content-length']).toBe(String(png.byteLength))
    expect((await probe.body()).byteLength).toBe(0)
  })
})

test('a card path that names no diff answers 404', async ({request}) => {
  const response = await request.get('/og/diffs/not-a-diff.png')
  expect(response.status()).toBe(404)
  const probe = await request.head('/og/diffs/not-a-diff.png')
  expect(probe.status()).toBe(404)
})
