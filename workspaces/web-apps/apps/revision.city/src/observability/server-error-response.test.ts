import {expect, test, vi} from 'vitest'
import {type CaptureMessage, reportServerErrorResponse} from './server-error-response'

const callback = 'https://revision.city/api/auth/github/callback?code=secret-code&state=s'

test('reportServerErrorResponse captures a 5xx with the method, path, and status', () => {
  const captureMessage = vi.fn<CaptureMessage>()

  reportServerErrorResponse({
    request: new Request(callback),
    response: new Response('GitHub sign-in failed. Try again.', {status: 502}),
    captureMessage,
  })

  expect(captureMessage).toHaveBeenCalledExactlyOnceWith(
    'GET /api/auth/github/callback answered 502',
    'error',
  )
})

test.each([200, 302, 400, 404])('reportServerErrorResponse ignores a %i', (status) => {
  const captureMessage = vi.fn<CaptureMessage>()

  reportServerErrorResponse({
    request: new Request(callback),
    response: new Response(null, {status}),
    captureMessage,
  })

  expect(captureMessage).not.toHaveBeenCalled()
})
