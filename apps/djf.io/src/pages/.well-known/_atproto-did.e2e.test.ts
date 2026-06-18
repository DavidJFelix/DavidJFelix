import {expect, test} from '@playwright/test'
import {ATPROTO_DID} from '../../lib/standard-site'

test('/.well-known/atproto-did serves the bare DID as plain text', async ({request}) => {
  const response = await request.get('/.well-known/atproto-did')

  expect(response.status()).toBe(200)
  expect((await response.text()).trim()).toBe(ATPROTO_DID)
})
