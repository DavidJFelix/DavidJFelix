import {type APIRequestContext, expect, test} from '@playwright/test'

const locsFrom = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])

const sitemapPaths = async (request: APIRequestContext): Promise<string[]> => {
  const index = await request.get('/sitemap-index.xml')
  expect(index.ok()).toBe(true)
  const sitemapLoc = locsFrom(await index.text())[0]
  const sitemap = await request.get(new URL(sitemapLoc).pathname)
  expect(sitemap.ok()).toBe(true)
  return locsFrom(await sitemap.text())
}

test('robots.txt is served and points at the sitemap', async ({request}) => {
  const response = await request.get('/robots.txt')
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain('Sitemap: https://djf.io/sitemap-index.xml')
})

test('sitemap lists the home page and every blog post', async ({request}) => {
  const locs = await sitemapPaths(request)
  expect(locs).toContain('https://djf.io/')
  expect(locs).toContain('https://djf.io/blog/')
  expect(locs).toContain('https://djf.io/blog/2025-12-07-on-running/')
})

test('every sitemap page has a title, meta description, and self-referencing canonical', async ({
  page,
  request,
}) => {
  for (const loc of await sitemapPaths(request)) {
    await page.goto(new URL(loc).pathname)
    expect(await page.title(), `${loc} title`).toMatch(/\S/)
    const description = page.locator('head meta[name="description"]')
    await expect(description, `${loc} description`).toHaveAttribute('content', /\S/)
    const canonical = page.locator('head link[rel="canonical"]')
    await expect(canonical, `${loc} canonical`).toHaveAttribute('href', loc)
  }
})

test('every sitemap page has Open Graph and Twitter card meta with a served og image', async ({
  page,
  request,
}) => {
  const imagePaths = new Set<string>()
  for (const loc of await sitemapPaths(request)) {
    await page.goto(new URL(loc).pathname)
    const head = page.locator('head')
    await expect(head.locator('meta[property="og:title"]'), `${loc} og:title`).toHaveAttribute(
      'content',
      /\S/,
    )
    await expect(
      head.locator('meta[property="og:description"]'),
      `${loc} og:description`,
    ).toHaveAttribute('content', /\S/)
    await expect(head.locator('meta[property="og:type"]'), `${loc} og:type`).toHaveAttribute(
      'content',
      /^(website|article)$/,
    )
    await expect(head.locator('meta[property="og:url"]'), `${loc} og:url`).toHaveAttribute(
      'content',
      loc,
    )
    await expect(head.locator('meta[name="twitter:card"]'), `${loc} twitter:card`).toHaveAttribute(
      'content',
      'summary_large_image',
    )
    const ogImage = await head.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage, `${loc} og:image`).toMatch(/^https:\/\/djf\.io\/og\/.+\.png$/)
    imagePaths.add(new URL(ogImage as string).pathname)
  }
  for (const imagePath of imagePaths) {
    const response = await request.get(imagePath)
    expect(response.ok(), `${imagePath} served`).toBe(true)
    expect(response.headers()['content-type'], `${imagePath} content type`).toContain('image/png')
  }
})

test('home page advertises the RSS feed', async ({page}) => {
  await page.goto('/')
  const alternate = page.locator('head link[rel="alternate"][type="application/rss+xml"]')
  await expect(alternate).toHaveAttribute('href', '/rss.xml')
})

test('blog posts embed BlogPosting and BreadcrumbList JSON-LD matching the page', async ({
  page,
}) => {
  await page.goto('/blog/2025-12-07-on-running/')
  const scripts = page.locator('script[type="application/ld+json"]')
  const jsonLd = JSON.parse((await scripts.first().textContent()) as string)
  expect(jsonLd['@type']).toBe('BlogPosting')
  expect(jsonLd.headline).toBe((await page.locator('h1').textContent())?.trim())
  expect(jsonLd.url).toBe('https://djf.io/blog/2025-12-07-on-running/')
  expect(jsonLd.image).toBe('https://djf.io/og/blog/2025-12-07-on-running.png')
  expect(jsonLd.datePublished).toBe('2025-12-07T00:00:00.000Z')

  const breadcrumb = JSON.parse((await scripts.nth(1).textContent()) as string)
  expect(breadcrumb['@type']).toBe('BreadcrumbList')
  expect(breadcrumb.itemListElement.map((item: {item: string}) => item.item)).toEqual([
    'https://djf.io/',
    'https://djf.io/blog/',
    'https://djf.io/blog/2025-12-07-on-running/',
  ])
})
