import {expect, test} from 'vitest'

import {createLoaderError, getLoaderErrorStatus} from './loader-error'

test('a loader error keeps its message', () => {
  expect(createLoaderError({message: 'Unsupported path.', status: 400}).message).toBe(
    'Unsupported path.',
  )
})

test.each([
  {
    name: 'a 400 loader error',
    error: createLoaderError({message: 'bad', status: 400}),
    status: 400,
  },
  {
    name: 'a 404 loader error',
    error: createLoaderError({message: 'gone', status: 404}),
    status: 404,
  },
  {
    name: 'a 503 loader error',
    error: createLoaderError({message: 'down', status: 503}),
    status: 502,
  },
  {
    name: 'a 302 loader error',
    error: createLoaderError({message: 'moved', status: 302}),
    status: 502,
  },
  {name: 'an error with no cause', error: new Error('failed'), status: 502},
  {name: 'an error with a text cause', error: new Error('large', {cause: 'large'}), status: 502},
  {
    name: 'a status that is not a number',
    error: new Error('odd', {cause: {status: '404'}}),
    status: 502,
  },
  {name: 'a value that is not an error', error: {cause: {status: 404}}, status: 502},
])('$name gives $status', ({error, status}) => {
  expect(getLoaderErrorStatus(error)).toBe(status)
})
