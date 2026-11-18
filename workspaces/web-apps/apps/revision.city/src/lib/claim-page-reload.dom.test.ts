import {expect, test} from 'vitest'

import {claimPageReload} from './claim-page-reload'

const ASSET_URL = '/assets/worker-abc.js'

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

test('the first claim for an asset allows a reload, and later claims do not', () => {
  const storage = memoryStorage()

  const first = claimPageReload({assetUrl: ASSET_URL, storage})
  const second = claimPageReload({assetUrl: ASSET_URL, storage})

  expect(first).toBe(true)
  expect(second).toBe(false)
})

test('a claim for a different asset allows its own reload', () => {
  const storage = memoryStorage()
  claimPageReload({assetUrl: ASSET_URL, storage})

  const claimed = claimPageReload({assetUrl: '/assets/route-def.js', storage})

  expect(claimed).toBe(true)
})

test('storage that throws allows no reload', () => {
  const storage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    },
    setItem: () => {},
  }

  const claimed = claimPageReload({assetUrl: ASSET_URL, storage})

  expect(claimed).toBe(false)
})

test('without a storage argument, the claim uses session storage', () => {
  sessionStorage.clear()

  const first = claimPageReload({assetUrl: ASSET_URL})
  const second = claimPageReload({assetUrl: ASSET_URL})

  expect([first, second]).toEqual([true, false])
  sessionStorage.clear()
})
