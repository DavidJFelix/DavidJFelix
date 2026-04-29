import {expect, test} from '@playwright/test'

test('rss feed serves valid xml with post entries', async ({request}) => {
  const response = await request.get('/rss.xml')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('xml')

  const body = await response.text()
  expect(body).toContain('<rss')
  expect(body).toMatch(/<title>David J\. Felix(&apos;|')s Blog<\/title>/)
  expect(body).toContain('<item>')
  expect(body).toContain('On Running')
})
