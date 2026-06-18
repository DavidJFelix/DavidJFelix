import {expect, test} from '@playwright/test'
import {publicationUri} from '../../lib/standard-site'

test('/.well-known/site.standard.publication serves the publication AT-URI', async ({request}) => {
  const response = await request.get('/.well-known/site.standard.publication')

  expect(response.status()).toBe(200)
  const body = (await response.text()).trim()
  expect(body).toBe(publicationUri())
  expect(body.startsWith('at://')).toBe(true)
})
