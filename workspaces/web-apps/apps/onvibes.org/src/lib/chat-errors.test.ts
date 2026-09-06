import {expect, test} from 'vitest'

import {describeChatError} from './chat-errors'

test.each([
  [
    'the unconfigured server',
    'HTTP error! status: 503 Service Unavailable',
    'Chat is not set up on this server yet.',
  ],
  ['a rejected request', 'HTTP error! status: 400 Bad Request', 'The reply did not come through.'],
  ['a network failure', 'Failed to fetch', 'The reply did not come through.'],
  ['an error without a message', '', 'The reply did not come through.'],
])('describes %s', (_name, message, expected) => {
  // when
  const copy = describeChatError(new Error(message))

  // then
  expect(copy).toBe(expected)
})
